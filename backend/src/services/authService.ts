import { hashPassword, verifyPassword } from '../auth/password.ts'
import { DEFAULT_MEMBER_SLUG } from '../auth/permissions.ts'
import { createSession, revokeSession, type AuthContext } from '../auth/sessionStore.ts'
import { hashToken } from '../auth/tokens.ts'
import { demoAccounts, seededAccounts, showDemoAccounts } from '../config/seedAccounts.ts'
import { isUniqueViolation, prisma } from '../db/prisma.ts'
import { Events } from '../realtime/events.ts'
import { broadcastToOrg, disconnectSession } from '../realtime/socket.ts'
import { ApiError } from '../utils/ApiError.ts'
import { newId } from '../utils/time.ts'
import type { AcceptInviteInput, LoginInput, RegisterInput } from '../validation/schemas.ts'
import { ensureDefaultRoles, permissionsForRole } from './accessControl.ts'

// Browser details stored with a new login session.
export interface RequestMeta {
  userAgent?: string | undefined
  ip?: string | undefined
}

// The Session shape the frontend stores after login: who you are, your role and what it allows.
export interface SessionResponse {
  token: string
  user: { id: string; fullName: string; email: string }
  organization: { id: string; name: string }
  role: string
  roleName: string
  permissions: string[]
}

// A user belongs to one organization in this app; if there are several, use the oldest.
async function findAccountByEmail(email: string) {
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

type Account = NonNullable<Awaited<ReturnType<typeof findAccountByEmail>>>
type Membership = NonNullable<Account['membership']>

async function toSession(token: string, account: Account, membership: Membership): Promise<SessionResponse> {
  return {
    token,
    user: { id: account.id, fullName: account.fullName, email: account.email },
    organization: { id: membership.organization.id, name: membership.organization.name },
    role: membership.role.slug,
    roleName: membership.role.name,
    permissions: await permissionsForRole(membership.role.id),
  }
}

export const PENDING_MESSAGE = 'Your account is waiting for a manager to approve it. You can log in once it is approved.'

// Sign-up joins an existing organization as a *pending* employee. No session is created:
// the person cannot log in or see anything until a manager approves them in Settings → Members.
export async function register({ fullName, organizationName, email, password }: RegisterInput): Promise<{ pending: true; message: string }> {
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

export async function login({ email, password }: LoginInput, meta: RequestMeta): Promise<SessionResponse> {
  const account = await findAccountByEmail(email)
  const valid = await verifyPassword(password, account?.passwordHash)
  // Same message for "no such user", "wrong password" and "not activated yet".
  if (!account || !valid) throw ApiError.unauthorized('Email or password is incorrect.')
  const { membership } = account
  if (!membership) throw ApiError.forbidden('This account is not part of any organization.')
  // Checked only after the password, so strangers cannot probe which emails are pending.
  if (membership.status !== 'active') throw ApiError.forbidden(PENDING_MESSAGE)

  const token = await createSession({ userId: account.id, organizationId: membership.organization.id, ...meta })
  return toSession(token, account, membership)
}

export async function logout(sessionId: string): Promise<void> {
  await revokeSession(sessionId)
  disconnectSession(sessionId)
}

// Invited members set their first password with the token from their invitation link.
export async function acceptInvite({ token, password }: AcceptInviteInput, meta: RequestMeta): Promise<SessionResponse> {
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
  if (!account?.membership) throw invalid()
  const sessionToken = await createSession({ userId: account.id, organizationId: account.membership.organization.id, ...meta })
  return toSession(sessionToken, account, account.membership)
}

// The caller's current session details (role and permissions may have changed since login).
export function currentSession(auth: AuthContext) {
  return {
    user: auth.user,
    organizationId: auth.organizationId,
    role: auth.role,
    roleName: auth.roleName,
    permissions: auth.permissions,
  }
}

export interface DemoAccount {
  fullName: string
  email: string
  password: string
  role: string
  roleName: string
}

// One-click logins for the login page, while SHOW_DEMO_ACCOUNTS is on (off in production by default).
// Only accounts that exist, are active and can log in are listed.
export async function listDemoAccounts(): Promise<DemoAccount[]> {
  if (!showDemoAccounts) return []
  const candidates = [...seededAccounts, ...demoAccounts]
  const users = await prisma.user.findMany({
    where: { email: { in: candidates.map((a) => a.email) }, passwordHash: { not: null } },
    select: { email: true, memberships: { where: { status: 'active' }, take: 1, select: { role: { select: { slug: true, name: true } } } } },
  })
  const roleByEmail = new Map<string, { slug: string; name: string }>()
  for (const u of users) {
    const role = u.memberships[0]?.role
    if (role) roleByEmail.set(u.email, role)
  }
  return candidates.flatMap((a) => {
    const role = roleByEmail.get(a.email)
    return role ? [{ fullName: a.fullName, email: a.email, password: a.password, role: role.slug, roleName: role.name }] : []
  })
}
