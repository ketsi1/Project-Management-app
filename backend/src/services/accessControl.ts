// Keeps the permissions / roles / role_permissions tables in step with auth/permissions.ts.
// Used by the seeders and whenever an organization needs its default roles.
// Every function takes `db`: the Prisma client or a transaction client.
import { prisma, type Db } from '../db/prisma.ts'
import { newId } from '../utils/time.ts'
import { DEFAULT_ROLES, OWNER_SLUG, PERMISSIONS, PERMISSION_KEYS, type DefaultRoleSlug } from '../auth/permissions.ts'
import type { Role } from '../generated/prisma/client.ts'

// Upserts every permission in the catalog and deletes ones that no longer exist.
// A permission seen for the first time is also given to the default roles that list it, in
// every organization, so existing Admin/Manager/Member roles pick up new features.
export async function syncPermissionCatalog(db: Db = prisma): Promise<number> {
  const existing = new Set((await db.permission.findMany({ select: { key: true } })).map((p) => p.key))
  const added = PERMISSION_KEYS.filter((key) => !existing.has(key))

  for (const p of PERMISSIONS) {
    await db.permission.upsert({
      where: { key: p.key },
      create: { id: newId(), key: p.key, name: p.name, description: p.description, groupName: p.group },
      update: { name: p.name, description: p.description, groupName: p.group },
    })
  }
  await db.permission.deleteMany({ where: { key: { notIn: [...PERMISSION_KEYS] } } })

  // On a brand-new database nothing has roles yet; ensureDefaultRoles fills them in later.
  if (existing.size > 0) {
    for (const key of added) {
      const slugs = DEFAULT_ROLES.filter((r) => (r.permissions as readonly string[]).includes(key)).map((r) => r.slug)
      if (slugs.length === 0) continue
      const permission = await db.permission.findUnique({ where: { key }, select: { id: true } })
      if (!permission) continue
      const roles = await db.role.findMany({ where: { slug: { in: slugs } }, select: { id: true } })
      await db.rolePermission.createMany({
        data: roles.map((r) => ({ roleId: r.id, permissionId: permission.id })),
        skipDuplicates: true,
      })
    }
  }
  return PERMISSIONS.length
}

// Replaces a role's permissions with exactly `keys` (unknown keys are ignored).
export async function setRolePermissions(db: Db, roleId: string, keys: readonly string[]): Promise<void> {
  await db.rolePermission.deleteMany({ where: { roleId } })
  if (keys.length === 0) return
  const permissions = await db.permission.findMany({ where: { key: { in: [...keys] } }, select: { id: true } })
  await db.rolePermission.createMany({ data: permissions.map((p) => ({ roleId, permissionId: p.id })) })
}

// The id of each default role in one organization: { owner, admin, manager, member }.
export type DefaultRoleIds = Record<DefaultRoleSlug, string>

// Makes sure an organization has the default roles.
// - The owner role always gets every permission.
// - Other default roles get their default permissions when they are new or have none yet,
//   or always when `reset` is true. Changes an admin made are kept otherwise.
export async function ensureDefaultRoles(db: Db, organizationId: string, { reset = false } = {}): Promise<DefaultRoleIds> {
  const ids: Partial<DefaultRoleIds> = {}
  for (const def of DEFAULT_ROLES) {
    const role = await db.role.upsert({
      where: { organizationId_slug: { organizationId, slug: def.slug } },
      create: { id: newId(), organizationId, slug: def.slug, name: def.name, description: def.description, isSystem: def.system },
      update: { isSystem: def.system, ...(reset ? { name: def.name, description: def.description } : {}) },
      select: { id: true, _count: { select: { permissions: true } } },
    })
    ids[def.slug] = role.id
    if (def.slug === OWNER_SLUG || reset || role._count.permissions === 0) {
      await setRolePermissions(db, role.id, def.permissions)
    }
  }
  // The loop above went through every default role, so every slug is filled in.
  return ids as DefaultRoleIds
}

// Catalog + default roles for every organization. Safe to run any number of times.
export async function syncAccessControl(db: Db = prisma, { reset = false } = {}): Promise<{ permissionCount: number; organizationCount: number }> {
  const permissionCount = await syncPermissionCatalog(db)
  const orgs = await db.organization.findMany({ select: { id: true } })
  for (const org of orgs) await ensureDefaultRoles(db, org.id, { reset })
  return { permissionCount, organizationCount: orgs.length }
}

export function findRoleBySlug(organizationId: string, slug: string, db: Db = prisma): Promise<Role | null> {
  return db.role.findUnique({ where: { organizationId_slug: { organizationId, slug } } })
}

// The permission keys of one role.
export async function permissionsForRole(roleId: string, db: Db = prisma): Promise<string[]> {
  const rows = await db.rolePermission.findMany({ where: { roleId }, select: { permission: { select: { key: true } } } })
  return rows.map((r) => r.permission.key).sort()
}
