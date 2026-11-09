// Roles and their permissions, managed by people whose role has 'roles.manage'.
import { OWNER_SLUG, PERMISSIONS, isPermissionKey } from '../auth/permissions.ts'
import type { AuthContext } from '../auth/sessionStore.ts'
import { prisma } from '../db/prisma.ts'
import type { Role } from '../generated/prisma/client.ts'
import { can } from '../middleware/auth.ts'
import { Events } from '../realtime/events.ts'
import { broadcastToOrg } from '../realtime/socket.ts'
import { ApiError } from '../utils/ApiError.ts'
import { newId } from '../utils/time.ts'
import type { RoleInput } from '../validation/schemas.ts'
import { setRolePermissions } from './accessControl.ts'

const ROLE_ORDER = ['owner', 'admin', 'manager', 'member']
const rank = (slug: string): number => (ROLE_ORDER.includes(slug) ? ROLE_ORDER.indexOf(slug) : ROLE_ORDER.length)

export interface RoleDto {
  id: string
  slug: string
  name: string
  description: string
  isSystem: boolean
  locked: boolean
  permissions: string[]
  memberCount: number
}

// The permission catalog, for the role editor.
export function listPermissions(): { key: string; name: string; description: string; group: string }[] {
  return PERMISSIONS.map(({ key, name, description, group }) => ({ key, name, description, group }))
}

export async function listRoles(organizationId: string): Promise<RoleDto[]> {
  const roles = await prisma.role.findMany({
    where: { organizationId },
    orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }, { name: 'asc' }],
    include: {
      permissions: { select: { permission: { select: { key: true } } } },
      _count: { select: { members: true } },
    },
  })
  return roles
    .map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      locked: r.slug === OWNER_SLUG,
      permissions: r.permissions.map((p) => p.permission.key).sort(),
      memberCount: r._count.members,
    }))
    .sort((a, b) => rank(a.slug) - rank(b.slug))
}

async function findRole(organizationId: string, id: string): Promise<Role> {
  const role = await prisma.role.findFirst({ where: { id, organizationId } })
  if (!role) throw ApiError.notFound('Role not found.')
  return role
}

// You cannot give a role more than your own role allows (the owner can give anything).
function assertGrantable(auth: AuthContext, permissions: string[]): void {
  const unknown = permissions.filter((key) => !isPermissionKey(key))
  if (unknown.length > 0) throw ApiError.badRequest(`Unknown permission: ${unknown[0]}`)
  if (auth.role === OWNER_SLUG) return
  const missing = permissions.filter((key) => !can(auth, key))
  if (missing.length > 0) throw ApiError.forbidden('You cannot give a role permissions your own role does not have.')
}

const slugify = (name: string): string =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'role'

async function uniqueSlug(organizationId: string, name: string): Promise<string> {
  const base = slugify(name)
  const rows = await prisma.role.findMany({ where: { organizationId, slug: { startsWith: base } }, select: { slug: true } })
  const taken = new Set(rows.map((r) => r.slug))
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}

async function assertNameFree(organizationId: string, name: string, exceptId?: string): Promise<void> {
  const clash = await prisma.role.findFirst({ where: { organizationId, name, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true } })
  if (clash) throw ApiError.conflict('A role with this name already exists.')
}

function changed(auth: AuthContext): void {
  broadcastToOrg(auth.organizationId, Events.WORKSPACE_CHANGED, { section: 'roles' })
  // Visible projects can depend on permissions.
  broadcastToOrg(auth.organizationId, Events.PROJECTS_CHANGED, { action: 'roles' })
}

async function findListedRole(organizationId: string, id: string): Promise<RoleDto> {
  const role = (await listRoles(organizationId)).find((r) => r.id === id)
  if (!role) throw ApiError.notFound('Role not found.')
  return role
}

export async function createRole(auth: AuthContext, { name, description, permissions }: RoleInput): Promise<RoleDto> {
  assertGrantable(auth, permissions)
  await assertNameFree(auth.organizationId, name)
  const id = newId()
  const slug = await uniqueSlug(auth.organizationId, name)
  await prisma.$transaction(async (tx) => {
    await tx.role.create({ data: { id, organizationId: auth.organizationId, slug, name, description, isSystem: false } })
    await setRolePermissions(tx, id, permissions)
  })
  changed(auth)
  return findListedRole(auth.organizationId, id)
}

export async function updateRole(auth: AuthContext, id: string, { name, description, permissions }: RoleInput): Promise<RoleDto> {
  const role = await findRole(auth.organizationId, id)
  if (role.slug === OWNER_SLUG) throw ApiError.badRequest('The owner role always has every permission and cannot be changed.')
  if (role.id === auth.roleId && auth.role !== OWNER_SLUG) {
    throw ApiError.forbidden('You cannot change your own role. Ask the owner or another admin.')
  }
  assertGrantable(auth, permissions)
  await assertNameFree(auth.organizationId, name, id)

  await prisma.$transaction(async (tx) => {
    await tx.role.update({ where: { id }, data: { name, description } })
    await setRolePermissions(tx, id, permissions)
  })
  changed(auth)
  return findListedRole(auth.organizationId, id)
}

export async function deleteRole(auth: AuthContext, id: string): Promise<void> {
  const role = await findRole(auth.organizationId, id)
  if (role.isSystem) throw ApiError.badRequest('Built-in roles cannot be deleted.')
  const inUse = await prisma.organizationMember.count({ where: { roleId: id } })
  if (inUse > 0) throw ApiError.badRequest(`${inUse} member(s) still have this role. Give them another role first.`)
  await prisma.role.delete({ where: { id } })
  changed(auth)
}
