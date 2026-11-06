// Seeders for authorization data, the starting accounts and the demo data. Each is safe to run repeatedly.
//
//   npm run seed               permissions + roles + admin + one account per role
//   npm run seed:permissions   the permission catalog (src/auth/permissions.js)
//   npm run seed:roles         default roles for every organization, with their permissions
//   npm run seed:admin         the organization (if missing) and its admin account
//   npm run seed:users         one account per non-admin default role (manager, member)
//   npm run seed:demo          the Acme Corp demo data (projects, tasks, bugs)
//
// Add --reset (e.g. `npm run seed:roles -- --reset`) to put default roles back to their default
// permissions and reset the seeded accounts' passwords and roles to the values in .env /
// src/config/seedAccounts.js. `npx prisma migrate reset` runs `all` and then `demo`.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { hashPassword } from '../../src/auth/password.js'
import { seededAccounts, seedOrganizationName } from '../../src/config/seedAccounts.js'
import { prisma } from '../../src/db/prisma.js'
import { ensureDefaultRoles, findRoleBySlug, syncAccessControl, syncPermissionCatalog } from '../../src/services/accessControl.js'
import { createStarterContent } from '../../src/services/organizationSetup.js'
import { newId } from '../../src/utils/time.js'
import { seedDemoData } from './demo.js'

const say = (text) => console.info(`  ✓ ${text}`)

export async function seedPermissions(db) {
  say(`${await syncPermissionCatalog(db)} permissions`)
}

export async function seedRoles(db, { reset = false } = {}) {
  const { organizationCount } = await syncAccessControl(db, { reset })
  say(`default roles${reset ? ' (reset to defaults)' : ''} for ${organizationCount} organization(s)`)
}

// The organization the seeded accounts belong to: the one the seeded admin is already in (so
// renaming the organization in Settings doesn't matter), else the one named SEED_ORG_NAME.
// Created (with starter content) only when neither exists.
async function seedOrganization(db, { reset }) {
  const adminEmail = seededAccounts.find((a) => a.key === 'admin').email
  const existing =
    (await db.organizationMember.findFirst({ where: { user: { email: adminEmail } }, select: { organizationId: true } }).then((m) => m && { id: m.organizationId })) ??
    (await db.organization.findFirst({ where: { name: seedOrganizationName }, orderBy: { createdAt: 'asc' }, select: { id: true } }))
  if (existing) {
    await ensureDefaultRoles(db, existing.id, { reset })
    return { organizationId: existing.id, created: false }
  }
  const organization = await db.organization.create({ data: { id: newId(), name: seedOrganizationName } })
  await ensureDefaultRoles(db, organization.id)
  say(`organization "${seedOrganizationName}"`)
  return { organizationId: organization.id, created: true }
}

// Creates the account (or brings an existing one in line) with the given role, active.
async function seedAccount(db, organizationId, account, { reset }) {
  const role = await findRoleBySlug(organizationId, account.roleSlug, db)
  if (!role) throw new Error(`Role "${account.roleSlug}" is missing. Run npm run seed:roles first.`)

  const existing = await db.user.findUnique({
    where: { email: account.email },
    select: { id: true, passwordHash: true, memberships: { select: { organizationId: true } } },
  })
  if (existing?.memberships.some((m) => m.organizationId !== organizationId)) {
    console.warn(`  ! ${account.email} already belongs to another organization — skipped`)
    return null
  }

  let userId = existing?.id
  if (!existing) {
    userId = newId()
    await db.user.create({
      data: {
        id: userId,
        fullName: account.fullName,
        email: account.email,
        passwordHash: await hashPassword(account.password),
        memberships: { create: { id: newId(), organizationId, roleId: role.id, status: 'active' } },
      },
    })
  } else {
    if (reset || !existing.passwordHash) {
      await db.user.update({
        where: { id: userId },
        data: { fullName: account.fullName, passwordHash: await hashPassword(account.password), invitationToken: null },
      })
    }
    // Keep a role an admin changed later, unless --reset.
    await db.organizationMember.upsert({
      where: { organizationId_userId: { organizationId, userId } },
      create: { id: newId(), organizationId, userId, roleId: role.id, status: 'active' },
      update: { status: 'active', ...(reset ? { roleId: role.id } : {}) },
    })
  }
  const showPassword = !existing || reset
  say(`${role.name}: ${account.email}${showPassword ? ` / ${account.password}` : ' (already existed, password kept)'}`)
  return userId
}

export async function seedAdmin(db, { reset = false } = {}) {
  await syncPermissionCatalog(db)
  const { organizationId, created } = await seedOrganization(db, { reset })
  const adminId = await seedAccount(db, organizationId, seededAccounts.find((a) => a.key === 'admin'), { reset })
  // A brand-new organization gets the same starter board as any other new organization.
  if (created && adminId) await createStarterContent(db, { organizationId, ownerId: adminId })
}

export async function seedUsers(db, { reset = false } = {}) {
  await syncPermissionCatalog(db)
  const { organizationId } = await seedOrganization(db, { reset })
  for (const account of seededAccounts.filter((a) => a.key !== 'admin')) {
    await seedAccount(db, organizationId, account, { reset })
  }
}

export async function seedDemo(db) {
  await syncPermissionCatalog(db)
  await seedDemoData(db)
  say('Acme Corp demo data (projects, tasks, bugs)')
}

export async function seedAll(db, options = {}) {
  await seedPermissions(db)
  await seedRoles(db, options)
  await seedAdmin(db, options)
  await seedUsers(db, options)
}

const tasks = { all: seedAll, permissions: seedPermissions, roles: seedRoles, admin: seedAdmin, users: seedUsers, demo: seedDemo }

// CLI: node prisma/seed/index.js <all|permissions|roles|admin|users|demo> [--reset] [--with-demo]
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const name = process.argv[2] ?? 'all'
  const reset = process.argv.includes('--reset')
  const task = tasks[name]
  if (!task) {
    console.error(`Unknown seeder "${name}". Use one of: ${Object.keys(tasks).join(', ')}`)
    process.exit(1)
  }
  console.info(`seed:${name}`)
  try {
    // One transaction: a failed seed changes nothing. Password hashing is slow, so allow a minute.
    await prisma.$transaction(
      async (tx) => {
        await task(tx, { reset })
        if (process.argv.includes('--with-demo') && name !== 'demo') await seedDemo(tx)
      },
      { timeout: 60_000, maxWait: 10_000 },
    )
    console.info('Done.')
  } catch (error) {
    console.error(`Failed: ${error.message}`)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}
