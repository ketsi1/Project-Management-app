// Roles and their permissions, managed by people whose role has 'roles.manage'.
import { OWNER_SLUG, PERMISSION_KEYS, PERMISSIONS } from '../auth/permissions.js'
import { query, transaction } from '../db/pool.js'
import { can } from '../middleware/auth.js'
import { Events } from '../realtime/events.js'
import { broadcastToOrg } from '../realtime/socket.js'
import { ApiError } from '../utils/ApiError.js'
import { newId } from '../utils/time.js'
import { setRolePermissions } from './accessControl.js'

// The permission catalog, for the role editor.
export function listPermissions() {
  return PERMISSIONS.map(({ key, name, description, group }) => ({ key, name, description, group }))
}

export async function listRoles(organizationId) {
  const [roles, grants, counts] = await Promise.all([
    query('SELECT * FROM roles WHERE organization_id = ? ORDER BY is_system DESC, created_at ASC, name ASC', [organizationId]),
    query(
      `SELECT rp.role_id, p.\`key\` FROM role_permissions rp
         JOIN permissions p ON p.id = rp.permission_id
         JOIN roles r ON r.id = rp.role_id
        WHERE r.organization_id = ?`,
      [organizationId],
    ),
    query('SELECT role_id, COUNT(*) AS n FROM organization_members WHERE organization_id = ? GROUP BY role_id', [organizationId]),
  ])
  const order = ['owner', 'admin', 'manager', 'member']
  const rank = (slug) => (order.includes(slug) ? order.indexOf(slug) : order.length)
  return roles
    .map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      description: r.description,
      isSystem: !!r.is_system,
      locked: r.slug === OWNER_SLUG,
      permissions: grants.filter((g) => g.role_id === r.id).map((g) => g.key).sort(),
      memberCount: Number(counts.find((c) => c.role_id === r.id)?.n ?? 0),
    }))
    .sort((a, b) => rank(a.slug) - rank(b.slug))
}

async function findRole(organizationId, id) {
  const rows = await query('SELECT * FROM roles WHERE id = ? AND organization_id = ?', [id, organizationId])
  if (rows.length === 0) throw ApiError.notFound('Role not found.')
  return rows[0]
}

// You cannot give a role more than your own role allows (the owner can give anything).
function assertGrantable(auth, permissions) {
  const unknown = permissions.filter((key) => !PERMISSION_KEYS.includes(key))
  if (unknown.length > 0) throw ApiError.badRequest(`Unknown permission: ${unknown[0]}`)
  if (auth.role === OWNER_SLUG) return
  const missing = permissions.filter((key) => !can(auth, key))
  if (missing.length > 0) throw ApiError.forbidden('You cannot give a role permissions your own role does not have.')
}

const slugify = (name) =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'role'

async function uniqueSlug(organizationId, name) {
  const base = slugify(name)
  const rows = await query('SELECT slug FROM roles WHERE organization_id = ? AND (slug = ? OR slug LIKE ?)', [organizationId, base, `${base}-%`])
  const taken = new Set(rows.map((r) => r.slug))
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}

async function assertNameFree(organizationId, name, exceptId = null) {
  const rows = await query('SELECT id FROM roles WHERE organization_id = ? AND name = ? AND id <> ?', [organizationId, name, exceptId ?? ''])
  if (rows.length > 0) throw ApiError.conflict('A role with this name already exists.')
}

function changed(auth, section = 'roles') {
  broadcastToOrg(auth.organizationId, Events.WORKSPACE_CHANGED, { section })
  // Visible projects can depend on permissions.
  broadcastToOrg(auth.organizationId, Events.PROJECTS_CHANGED, { action: 'roles' })
}

export async function createRole(auth, { name, description, permissions }) {
  assertGrantable(auth, permissions)
  await assertNameFree(auth.organizationId, name)
  const id = newId()
  const slug = await uniqueSlug(auth.organizationId, name)
  await transaction(async (connection) => {
    await query('INSERT INTO roles (id, organization_id, slug, name, description, is_system) VALUES (?, ?, ?, ?, ?, FALSE)', [id, auth.organizationId, slug, name, description], connection)
    await setRolePermissions(connection, id, permissions)
  })
  changed(auth)
  return (await listRoles(auth.organizationId)).find((r) => r.id === id)
}

export async function updateRole(auth, id, { name, description, permissions }) {
  const role = await findRole(auth.organizationId, id)
  if (role.slug === OWNER_SLUG) throw ApiError.badRequest('The owner role always has every permission and cannot be changed.')
  if (role.id === auth.roleId && auth.role !== OWNER_SLUG) {
    throw ApiError.forbidden('You cannot change your own role. Ask the owner or another admin.')
  }
  assertGrantable(auth, permissions)
  await assertNameFree(auth.organizationId, name, id)

  await transaction(async (connection) => {
    await query('UPDATE roles SET name = ?, description = ? WHERE id = ?', [name, description, id], connection)
    await setRolePermissions(connection, id, permissions)
  })
  changed(auth)
  return (await listRoles(auth.organizationId)).find((r) => r.id === id)
}

export async function deleteRole(auth, id) {
  const role = await findRole(auth.organizationId, id)
  if (role.is_system) throw ApiError.badRequest('Built-in roles cannot be deleted.')
  const [{ n }] = await query('SELECT COUNT(*) AS n FROM organization_members WHERE role_id = ?', [id])
  if (Number(n) > 0) throw ApiError.badRequest(`${n} member(s) still have this role. Give them another role first.`)
  await query('DELETE FROM roles WHERE id = ? AND organization_id = ?', [id, auth.organizationId])
  changed(auth)
}
