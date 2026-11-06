// Seeders for authorization data and the starting accounts. Each one is safe to run repeatedly.
//
//   npm run seed               permissions + roles + admin + one account per role
//   npm run seed:permissions   the permission catalog (src/auth/permissions.js)
//   npm run seed:roles         default roles for every organization, with their permissions
//   npm run seed:admin         the organization (if missing) and its admin account
//   npm run seed:users         one account per non-admin default role (manager, member)
//   npm run seed:demo          demo data from database/seed.sql (Acme Corp projects and tasks)
//
// Add --reset to put default roles back to their default permissions and reset the
// seeded accounts' passwords and roles to the values in .env / src/config/seedAccounts.js.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { hashPassword } from '../../src/auth/password.js'
import { seededAccounts, seedOrganizationName } from '../../src/config/seedAccounts.js'
import { ensureDefaultRoles, findRoleBySlug, syncAccessControl, syncPermissionCatalog } from '../../src/services/accessControl.js'
import { createStarterContent } from '../../src/services/organizationSetup.js'
import { newId } from '../../src/utils/time.js'
import { connect, runScript, runSqlFile } from '../lib/sql.js'

const say = (text) => console.info(`  ✓ ${text}`)

async function rows(connection, sql, params = []) {
  const [result] = await connection.execute(sql, params)
  return result
}

export async function seedPermissions(connection) {
  const count = await syncPermissionCatalog(connection)
  say(`${count} permissions`)
}

export async function seedRoles(connection, { reset = false } = {}) {
  const { organizationCount } = await syncAccessControl(connection, { reset })
  say(`default roles${reset ? ' (reset to defaults)' : ''} for ${organizationCount} organization(s)`)
}

// The organization the seeded accounts belong to. Created (with starter content) when missing.
async function seedOrganization(connection, { reset }) {
  const existing = await rows(connection, 'SELECT id FROM organizations WHERE name = ? ORDER BY created_at LIMIT 1', [seedOrganizationName])
  if (existing.length > 0) {
    await ensureDefaultRoles(connection, existing[0].id, { reset })
    return { organizationId: existing[0].id, created: false }
  }
  const organizationId = newId()
  await rows(connection, 'INSERT INTO organizations (id, name) VALUES (?, ?)', [organizationId, seedOrganizationName])
  await ensureDefaultRoles(connection, organizationId)
  say(`organization "${seedOrganizationName}"`)
  return { organizationId, created: true }
}

// Creates the account (or brings an existing one in line) with the given role, active.
async function seedAccount(connection, organizationId, account, { reset }) {
  const role = await findRoleBySlug(organizationId, account.roleSlug, connection)
  if (!role) throw new Error(`Role "${account.roleSlug}" is missing. Run npm run seed:roles first.`)

  const users = await rows(connection, 'SELECT id, password_hash FROM users WHERE email = ?', [account.email])
  let userId = users[0]?.id
  if (!userId) {
    userId = newId()
    await rows(connection, 'INSERT INTO users (id, full_name, email, password_hash) VALUES (?, ?, ?, ?)', [
      userId,
      account.fullName,
      account.email,
      await hashPassword(account.password),
    ])
  } else if (reset || !users[0].password_hash) {
    await rows(connection, 'UPDATE users SET full_name = ?, password_hash = ?, invitation_token = NULL WHERE id = ?', [
      account.fullName,
      await hashPassword(account.password),
      userId,
    ])
  }

  const memberships = await rows(connection, 'SELECT organization_id FROM organization_members WHERE user_id = ?', [userId])
  const elsewhere = memberships.find((m) => m.organization_id !== organizationId)
  if (elsewhere) {
    console.warn(`  ! ${account.email} already belongs to another organization — skipped`)
    return
  }
  if (memberships.length === 0) {
    await rows(connection, "INSERT INTO organization_members (id, organization_id, user_id, role_id, status) VALUES (?, ?, ?, ?, 'active')", [
      newId(),
      organizationId,
      userId,
      role.id,
    ])
  } else {
    // Keep a role an admin changed later, unless --reset.
    await rows(
      connection,
      `UPDATE organization_members SET status = 'active' ${reset ? ', role_id = ?' : ''} WHERE user_id = ? AND organization_id = ?`,
      reset ? [role.id, userId, organizationId] : [userId, organizationId],
    )
  }
  say(`${role.name}: ${account.email}${users.length === 0 || reset ? ` / ${account.password}` : ' (already existed, password kept)'}`)
  return userId
}

export async function seedAdmin(connection, { reset = false } = {}) {
  await syncPermissionCatalog(connection)
  const { organizationId, created } = await seedOrganization(connection, { reset })
  const admin = seededAccounts.find((a) => a.key === 'admin')
  const adminId = await seedAccount(connection, organizationId, admin, { reset })
  // A brand-new organization gets the same starter board as any other new organization.
  if (created && adminId) await createStarterContent(connection, { organizationId, ownerId: adminId })
}

export async function seedUsers(connection, { reset = false } = {}) {
  await syncPermissionCatalog(connection)
  const { organizationId } = await seedOrganization(connection, { reset })
  for (const account of seededAccounts.filter((a) => a.key !== 'admin')) {
    await seedAccount(connection, organizationId, account, { reset })
  }
}

export async function seedDemo(connection) {
  await runSqlFile(connection, 'seed.sql')
  await syncAccessControl(connection)
}

export async function seedAll(connection, options = {}) {
  await seedPermissions(connection)
  await seedRoles(connection, options)
  await seedAdmin(connection, options)
  await seedUsers(connection, options)
}

const tasks = {
  all: seedAll,
  permissions: seedPermissions,
  roles: seedRoles,
  admin: seedAdmin,
  users: seedUsers,
  demo: seedDemo,
}

// CLI: node scripts/seed/index.js <all|permissions|roles|admin|users|demo> [--reset]
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const name = process.argv[2] ?? 'all'
  const reset = process.argv.includes('--reset')
  const task = tasks[name]
  if (!task) {
    console.error(`Unknown seeder "${name}". Use one of: ${Object.keys(tasks).join(', ')}`)
    process.exit(1)
  }
  await runScript(`seed:${name}`, async () => {
    const connection = await connect()
    try {
      await connection.beginTransaction()
      await task(connection, { reset })
      await connection.commit()
    } catch (error) {
      await connection.rollback().catch(() => undefined)
      throw error
    } finally {
      await connection.end()
    }
  })
  // The app's shared pool is imported but never used here; don't wait for it.
  process.exit(process.exitCode ?? 0)
}

