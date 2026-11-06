import { hashPassword, verifyPassword } from '../auth/password.js'
import { createSession, revokeSession } from '../auth/sessionStore.js'
import { hashToken } from '../auth/tokens.js'
import { query, transaction } from '../db/pool.js'
import { disconnectSession } from '../realtime/socket.js'
import { ApiError } from '../utils/ApiError.js'
import { newId } from '../utils/time.js'
import { Events } from '../realtime/events.js'
import { broadcastToOrg } from '../realtime/socket.js'
import { DEFAULT_MEMBER_SLUG } from '../auth/permissions.js'
import { demoAccounts, seededAccounts, showDemoAccounts } from '../config/seedAccounts.js'
import { ensureDefaultRoles, permissionsForRole } from './accessControl.js'

// The Session shape the frontend stores after login: who you are, your role and what it allows.
async function toSession(token, account) {
  return {
    token,
    user: { id: account.id, fullName: account.full_name, email: account.email },
    organization: { id: account.org_id, name: account.org_name },
    role: account.role,
    roleName: account.role_name,
    permissions: await permissionsForRole(account.role_id),
  }
}

// A user belongs to one organization in this app; if there are several, use the oldest.
async function findAccountByEmail(email) {
  const rows = await query(
    `SELECT u.id, u.full_name, u.email, u.password_hash,
            r.id AS role_id, r.slug AS role, r.name AS role_name, m.status, o.id AS org_id, o.name AS org_name
       FROM users u
       LEFT JOIN organization_members m ON m.user_id = u.id
       LEFT JOIN roles r ON r.id = m.role_id
       LEFT JOIN organizations o ON o.id = m.organization_id
      WHERE u.email = ?
      ORDER BY m.created_at ASC
      LIMIT 1`,
    [email],
  )
  return rows[0] ?? null
}

export const PENDING_MESSAGE = 'Your account is waiting for a manager to approve it. You can log in once it is approved.'

// Sign-up joins an existing organization as a *pending* employee. No session is created:
// the person cannot log in or see anything until a manager approves them in Settings → Members.
export async function register({ fullName, organizationName, email, password }) {
  const existing = await query('SELECT id FROM users WHERE email = ?', [email])
  if (existing.length > 0) throw ApiError.conflict('An account with this email already exists.')

  // Name match ignores upper/lower case (the column's collation). If two share a name, the oldest wins.
  const orgs = await query('SELECT id FROM organizations WHERE name = ? ORDER BY created_at ASC LIMIT 1', [organizationName])
  if (orgs.length === 0) {
    throw ApiError.notFound('No organization with that name. Ask your manager for the exact organization name.')
  }
  const organizationId = orgs[0].id

  const passwordHash = await hashPassword(password)
  const userId = newId()

  try {
    await transaction(async (connection) => {
      // Sign-ups get the default member role (created first if the organization has no roles yet).
      const roleIds = await ensureDefaultRoles(connection, organizationId)
      await query(
        'INSERT INTO users (id, full_name, email, password_hash) VALUES (?, ?, ?, ?)',
        [userId, fullName, email, passwordHash],
        connection,
      )
      await query(
        "INSERT INTO organization_members (id, organization_id, user_id, role_id, status) VALUES (?, ?, ?, ?, 'pending')",
        [newId(), organizationId, userId, roleIds[DEFAULT_MEMBER_SLUG]],
        connection,
      )
    })
  } catch (error) {
    // Two sign-ups with the same email at the same moment: the unique index decides.
    if (error?.code === 'ER_DUP_ENTRY') throw ApiError.conflict('An account with this email already exists.')
    throw error
  }

  // Managers who are online see the new request appear in Settings → Members.
  broadcastToOrg(organizationId, Events.WORKSPACE_CHANGED, { section: 'members' })
  return { pending: true, message: PENDING_MESSAGE }
}

export async function login({ email, password }, meta) {
  const account = await findAccountByEmail(email)
  const valid = await verifyPassword(password, account?.password_hash)
  // Same message for "no such user", "wrong password" and "not activated yet".
  if (!account || !valid) throw ApiError.unauthorized('Email or password is incorrect.')
  if (!account.org_id) throw ApiError.forbidden('This account is not part of any organization.')
  // Checked only after the password, so strangers cannot probe which emails are pending.
  if (account.status !== 'active') throw ApiError.forbidden(PENDING_MESSAGE)

  const token = await createSession({ userId: account.id, organizationId: account.org_id, ...meta })
  return toSession(token, account)
}

export async function logout(sessionId) {
  await revokeSession(sessionId)
  disconnectSession(sessionId)
}

// Invited members set their first password with the token from their invitation link.
export async function acceptInvite({ token, password }, meta) {
  const invalid = () => ApiError.badRequest('This invitation link is invalid or has expired.')
  const rows = await query(
    `SELECT id, email FROM users
      WHERE invitation_token = ? AND invitation_expires_at > CURRENT_TIMESTAMP AND password_hash IS NULL`,
    [hashToken(token)],
  )
  if (rows.length === 0) throw invalid()

  const passwordHash = await hashPassword(password)
  // The WHERE clause makes the link single-use even if it is opened twice at once.
  const result = await query(
    `UPDATE users SET password_hash = ?, invitation_token = NULL, invitation_expires_at = NULL
      WHERE id = ? AND password_hash IS NULL`,
    [passwordHash, rows[0].id],
  )
  if (result.affectedRows !== 1) throw invalid()

  const account = await findAccountByEmail(rows[0].email)
  const sessionToken = await createSession({ userId: account.id, organizationId: account.org_id, ...meta })
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
  const emails = candidates.map((a) => a.email)
  const rows = await query(
    `SELECT u.email, r.name AS role_name, r.slug AS role
       FROM users u
       JOIN organization_members m ON m.user_id = u.id AND m.status = 'active'
       JOIN roles r ON r.id = m.role_id
      WHERE u.password_hash IS NOT NULL AND u.email IN (${emails.map(() => '?').join(', ')})`,
    emails,
  )
  const byEmail = new Map(rows.map((r) => [r.email, r]))
  return candidates
    .filter((a) => byEmail.has(a.email))
    .map((a) => ({ fullName: a.fullName, email: a.email, password: a.password, role: byEmail.get(a.email).role, roleName: byEmail.get(a.email).role_name }))
}
