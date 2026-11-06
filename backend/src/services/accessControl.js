// Keeps the permissions / roles / role_permissions tables in step with auth/permissions.js.
// Used by the seed scripts, by db:migrate, and whenever a new organization is created.
import { query } from '../db/pool.js'
import { newId } from '../utils/time.js'
import { DEFAULT_ROLES, OWNER_SLUG, PERMISSIONS, PERMISSION_KEYS } from '../auth/permissions.js'

// Upserts every permission in the catalog and deletes ones that no longer exist.
// A permission seen for the first time is also given to the default roles that list it, in
// every organization, so existing Admin/Manager/Member roles pick up new features.
export async function syncPermissionCatalog(connection) {
  const existing = new Set((await query('SELECT `key` FROM permissions', [], connection)).map((r) => r.key))
  const added = PERMISSION_KEYS.filter((key) => !existing.has(key))
  for (const p of PERMISSIONS) {
    await query(
      `INSERT INTO permissions (id, \`key\`, name, description, group_name) VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), group_name = VALUES(group_name)`,
      [newId(), p.key, p.name, p.description, p.group],
      connection,
    )
  }
  const placeholders = PERMISSION_KEYS.map(() => '?').join(', ')
  await query(`DELETE FROM permissions WHERE \`key\` NOT IN (${placeholders})`, PERMISSION_KEYS, connection)

  // On a brand-new database nothing has roles yet; ensureDefaultRoles fills them in later.
  if (existing.size > 0) {
    for (const key of added) {
      const slugs = DEFAULT_ROLES.filter((r) => r.permissions.includes(key)).map((r) => r.slug)
      if (slugs.length === 0) continue
      await query(
        `INSERT IGNORE INTO role_permissions (role_id, permission_id)
         SELECT r.id, p.id FROM roles r JOIN permissions p ON p.\`key\` = ?
          WHERE r.slug IN (${slugs.map(() => '?').join(', ')})`,
        [key, ...slugs],
        connection,
      )
    }
  }
  return PERMISSIONS.length
}

// Replaces a role's permissions with exactly `keys` (unknown keys are ignored).
export async function setRolePermissions(connection, roleId, keys) {
  await query('DELETE FROM role_permissions WHERE role_id = ?', [roleId], connection)
  if (keys.length === 0) return
  const placeholders = keys.map(() => '?').join(', ')
  await query(
    `INSERT INTO role_permissions (role_id, permission_id)
     SELECT ?, id FROM permissions WHERE \`key\` IN (${placeholders})`,
    [roleId, ...keys],
    connection,
  )
}

// Makes sure an organization has the default roles.
// - The owner role always gets every permission.
// - Other default roles get their default permissions when they are new or have none yet,
//   or always when `reset` is true. Changes an admin made are kept otherwise.
// Returns { slug: roleId } for the default roles.
export async function ensureDefaultRoles(connection, organizationId, { reset = false } = {}) {
  const ids = {}
  for (const role of DEFAULT_ROLES) {
    await query(
      `INSERT INTO roles (id, organization_id, slug, name, description, is_system) VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE is_system = VALUES(is_system)
         ${reset ? ', name = VALUES(name), description = VALUES(description)' : ''}`,
      [newId(), organizationId, role.slug, role.name, role.description, role.system],
      connection,
    )
    const [row] = await query(
      `SELECT r.id, COUNT(rp.permission_id) AS permissionCount
         FROM roles r LEFT JOIN role_permissions rp ON rp.role_id = r.id
        WHERE r.organization_id = ? AND r.slug = ?
        GROUP BY r.id`,
      [organizationId, role.slug],
      connection,
    )
    ids[role.slug] = row.id
    if (role.slug === OWNER_SLUG || reset || Number(row.permissionCount) === 0) {
      await setRolePermissions(connection, row.id, role.permissions)
    }
  }
  return ids
}

// Catalog + default roles for every organization. Safe to run any number of times.
export async function syncAccessControl(connection, { reset = false } = {}) {
  const permissionCount = await syncPermissionCatalog(connection)
  const orgs = await query('SELECT id, name FROM organizations', [], connection)
  for (const org of orgs) await ensureDefaultRoles(connection, org.id, { reset })
  return { permissionCount, organizationCount: orgs.length }
}

export async function findRoleBySlug(organizationId, slug, connection) {
  const rows = await query('SELECT * FROM roles WHERE organization_id = ? AND slug = ?', [organizationId, slug], connection)
  return rows[0] ?? null
}

// The permission keys of one role.
export async function permissionsForRole(roleId, connection) {
  const rows = await query(
    `SELECT p.\`key\` FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = ? ORDER BY p.\`key\``,
    [roleId],
    connection,
  )
  return rows.map((r) => r.key)
}
