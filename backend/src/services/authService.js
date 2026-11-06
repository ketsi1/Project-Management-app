import { hashPassword, verifyPassword } from '../auth/password.js'
import { DEFAULT_MEMBER_SLUG } from '../auth/permissions.js'
import { createSession, revokeSession } from '../auth/sessionStore.js'
import { hashToken } from '../auth/tokens.js'
import { demoAccounts, seededAccounts, showDemoAccounts } from '../config/seedAccounts.js'
import { isUniqueViolation, prisma } from '../db/prisma.js'
import { Events } from '../realtime/events.js'
import { broadcastToOrg, disconnectSession } from '../realtime/socket.js'
import { ApiError } from '../utils/ApiError.js'
import { newId } from '../utils/time.js'
import { ensureDefaultRoles, permissionsForRole } from './accessControl.js'

// The Session shape the frontend stores after login: who you are, your role and what it allows.
async function toSession(token, account) {
  return {
    token,
    user: { id: account.id, fullName: account.fullName, email: account.email },
    organization: { id: account.membership.organization.id, name: account.membership.organization.name },
    role: account.membership.role.slug,
    roleName: account.membership.role.name,
    permissions: await permissionsForRole(account.membership.role.id),
  }
}

// A user belongs to one organization in this app; if there are several, use the oldest.
async function findAccountByEmail(email) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      fullName: true,
      email: true,
      passwordHash: true,
      memberships: {
        orderBy: { createdAt: 'asc' },
        take: 1,
        select: {
          status: true,
          role: { select: { id: true, slug: true, name: true } },
          organization: { select: { id: true, name: true } },
        },
      },
    },
  })
  if (!user) return null
  const { memberships, ...rest } = user
  return { ...rest, membership: memberships[0] ?? null }
}

export const PENDING_MESSAGE = 'Your account is waiting for a manager to approve it. You can log in once it is approved.'

// Sign-up joins an existing organization as a *pending* employee. No session is created:
// the person cannot log in or see anything until a manager approves them in Settings → Members.
export async function register({ fullName, organizationName, email, password }) {
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    throw ApiError.conflict('An account with this email already exists.')
  }

  // Name match ignores upper/lower case (the column's collation). If two share a name, the oldest wins.
  const org = await prisma.organization.findFirst({ where: { name: organizationName }, orderBy: { createdAt: 'asc' }, select: { id: true } })
  if (!org) throw ApiError.notFound('No organization with that name. Ask your manager for the exact organization name.')

  const passwordHash = await hashPassword(password)
  try {
    await prisma.$transaction(async (tx) => {
      // Sign-ups get the default member role (created first if the organization has no roles yet).
      const roleIds = await ensureDefaultRoles(tx, org.id)
      await tx.user.create({
        data: {
          id: newId(),
          fullName,
          email,
          passwordHash,
          memberships: { create: { id: newId(), organizationId: org.id, roleId: roleIds[DEFAULT_MEMBER_SLUG], status: 'pending' } },
        },
      })
    })
  } catch (error) {
    // Two sign-ups with the same email at the same moment: the unique index decides.
    if (isUniqueViolation(error)) throw ApiError.conflict('An account with this email already exists.')
    throw error
  }

  // Managers who are online see the new request appear in Settings → Members.
  broadcastToOrg(org.id, Events.WORKSPACE_CHANGED, { section: 'members' })
  return { pending: true, message: PENDING_MESSAGE }
}

export async function login({ email, password }, meta) {
  const account = await findAccountByEmail(email)
  const valid = await verifyPassword(password, account?.passwordHash)
  // Same message for "no such user", "wrong password" and "not activated yet".
  if (!account || !valid) throw ApiError.unauthorized('Email or password is incorrect.')
  if (!account.membership) throw ApiError.forbidden('This account is not part of any organization.')
  // Checked only after the password, so strangers cannot probe which emails are pending.
  if (account.membership.status !== 'active') throw ApiError.forbidden(PENDING_MESSAGE)

  const token = await createSession({ userId: account.id, organizationId: account.membership.organization.id, ...meta })
  return toSession(token, account)
}

export async function logout(sessionId) {
  await revokeSession(sessionId)
  disconnectSession(sessionId)
}

// Invited members set their first password with the token from their invitation link.
export async function acceptInvite({ token, password }, meta) {
  const invalid = () => ApiError.badRequest('This invitation link is invalid or has expired.')
  const user = await prisma.user.findFirst({
    where: { invitationToken: hashToken(token), invitationExpiresAt: { gt: new Date() }, passwordHash: null },
    select: { id: true, email: true },
  })
  if (!user) throw invalid()

  const passwordHash = await hashPassword(password)
  // The passwordHash: null condition makes the link single-use even if it is opened twice at once.
  const { count } = await prisma.user.updateMany({
    where: { id: user.id, passwordHash: null },
    data: { passwordHash, invitationToken: null, invitationExpiresAt: null },
  })
  if (count !== 1) throw invalid()

  const account = await findAccountByEmail(user.email)
  const sessionToken = await createSession({ userId: account.id, organizationId: account.membership.organization.id, ...meta })
  return toSession(sessionToken, account)
}

// The caller's current session details (role and permissions may have changed since login).
export function currentSession(auth) {
  return {
    user: auth.user,
    organizationId: auth.organizationId,
    role: auth.role,
    roleName: auth.roleName,
    permissions: auth.permissions,
  }
}

// One-click logins for the login page, while SHOW_DEMO_ACCOUNTS is on (off in production by default).
// Only accounts that exist, are active and can log in are listed.
export async function listDemoAccounts() {
  if (!showDemoAccounts) return []
  const candidates = [...seededAccounts, ...demoAccounts]
  const users = await prisma.user.findMany({
    where: { email: { in: candidates.map((a) => a.email) }, passwordHash: { not: null } },
    select: { email: true, memberships: { where: { status: 'active' }, take: 1, select: { role: { select: { slug: true, name: true } } } } },
  })
  const byEmail = new Map(users.filter((u) => u.memberships.length > 0).map((u) => [u.email, u.memberships[0].role]))
  return candidates
    .filter((a) => byEmail.has(a.email))
    .map((a) => ({ fullName: a.fullName, email: a.email, password: a.password, role: byEmail.get(a.email).slug, roleName: byEmail.get(a.email).name }))
}
