import { env } from '../config/env.js'
import { hashPassword } from '../auth/password.js'
import { OWNER_SLUG } from '../auth/permissions.js'
import { createInviteToken } from '../auth/tokens.js'
import { query, transaction } from '../db/pool.js'
import { can } from '../middleware/auth.js'
import { Events } from '../realtime/events.js'
import { broadcastToOrg, disconnectUser } from '../realtime/socket.js'
import { ApiError } from '../utils/ApiError.js'
import { newId } from '../utils/time.js'
import { permissionsForRole } from './accessControl.js'

async function findRole(organizationId, roleId, connection) {
  const rows = await query('SELECT id, slug, name FROM roles WHERE id = ? AND organization_id = ?', [roleId, organizationId], connection)
  if (rows.length === 0) throw ApiError.badRequest('Choose a valid role.')
  return rows[0]
}

async function findMembership(organizationId, userId) {
  const rows = await query(
    `SELECT m.status, r.id AS role_id, r.slug AS role
       FROM organization_members m JOIN roles r ON r.id = m.role_id
      WHERE m.user_id = ? AND m.organization_id = ?`,
    [userId, organizationId],
  )
  if (rows.length === 0) throw ApiError.notFound('Member not found.')
  return rows[0]
}

// Nobody can hand out the owner role, or a role that allows more than their own role does.
async function assertCanAssign(auth, role) {
  if (role.slug === OWNER_SLUG) throw ApiError.badRequest('An organization has one owner. Choose another role.')
  if (auth.role === OWNER_SLUG) return
  const missing = (await permissionsForRole(role.id)).filter((key) => !can(auth, key))
  if (missing.length > 0) throw ApiError.forbidden(`You cannot give the ${role.name} role: it can do things your role cannot.`)
}

// The owner is untouchable, admins can only be changed by the owner, and nobody changes themselves.
function assertCanManage(auth, userId, membership, action) {
  if (userId === auth.userId) throw ApiError.badRequest(`You cannot ${action} yourself.`)
  if (membership.role === OWNER_SLUG) throw ApiError.badRequest(`The owner cannot be ${action === 'remove' ? 'removed' : 'changed'}.`)
  if (membership.role === 'admin' && auth.role !== OWNER_SLUG) throw ApiError.forbidden(`Only the owner can ${action} an admin.`)
}

// Adds someone to the organization with a role.
// - With a password: the account is ready right away and they can log in with it.
// - Without: the account waits for them to choose a password through an invitation link.
//   Until an email service is wired in, the link is printed to the server log and, outside
//   production, returned to the admin so they can pass it on.
export async function inviteMember(auth, { fullName, email, roleId, password }) {
  const role = await findRole(auth.organizationId, roleId)
  await assertCanAssign(auth, role)

  const existing = await query('SELECT id FROM users WHERE email = ?', [email])
  if (existing.length > 0) throw ApiError.conflict('This email already has an account.')

  const userId = newId()
  const invite = password ? null : createInviteToken()
  const expiresAt = new Date(Date.now() + env.auth.inviteTtlHours * 3600 * 1000)
  const passwordHash = password ? await hashPassword(password) : null

  try {
    await transaction(async (connection) => {
      await query(
        `INSERT INTO users (id, full_name, email, password_hash, invitation_token, invitation_expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, fullName, email, passwordHash, invite?.tokenHash ?? null, invite ? expiresAt : null],
        connection,
      )
      await query(
        "INSERT INTO organization_members (id, organization_id, user_id, role_id, status) VALUES (?, ?, ?, ?, 'active')",
        [newId(), auth.organizationId, userId, role.id],
        connection,
      )
    })
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') throw ApiError.conflict('This email already has an account.')
    throw error
  }

  let inviteLink
  if (invite) {
    const link = `${env.appUrl.replace(/\/$/, '')}/accept-invite?token=${invite.token}`
    console.info(`[invite] ${email} was invited by ${auth.user.email}. Activation link (valid ${env.auth.inviteTtlHours}h): ${link}`)
    if (!env.isProduction) inviteLink = link
  }

  broadcastToOrg(auth.organizationId, Events.WORKSPACE_CHANGED, { section: 'members' })
  return { id: userId, fullName, email, role: role.slug, roleId: role.id, roleName: role.name, activated: !!password, inviteLink }
}

// Lets a pending sign-up in. Needs 'members.approve' (see routes).
export async function approveMember(auth, id) {
  const result = await query(
    "UPDATE organization_members SET status = 'active' WHERE user_id = ? AND organization_id = ? AND status = 'pending'",
    [id, auth.organizationId],
  )
  if (result.affectedRows !== 1) throw ApiError.notFound('No pending sign-up found for this person.')
  broadcastToOrg(auth.organizationId, Events.WORKSPACE_CHANGED, { section: 'members' })
}

// Gives a member another role. Their next request already uses it (permissions are read per request).
export async function updateMemberRole(auth, id, roleId) {
  const membership = await findMembership(auth.organizationId, id)
  assertCanManage(auth, id, membership, 'change')
  const role = await findRole(auth.organizationId, roleId)
  await assertCanAssign(auth, role)

  await query('UPDATE organization_members SET role_id = ? WHERE user_id = ? AND organization_id = ?', [role.id, id, auth.organizationId])
  broadcastToOrg(auth.organizationId, Events.WORKSPACE_CHANGED, { section: 'members' })
  // Their project list may change with the new role.
  broadcastToOrg(auth.organizationId, Events.PROJECTS_CHANGED, { action: 'roles' })
  return { id, role: role.slug, roleId: role.id, roleName: role.name }
}

// Removes a member, or rejects a pending sign-up.
// Removing needs 'members.remove'; rejecting a sign-up needs 'members.approve' or 'members.remove'.
export async function removeMember(auth, id) {
  const membership = await findMembership(auth.organizationId, id)
  const rejecting = membership.status === 'pending'
  const allowed = rejecting ? can(auth, 'members.approve') || can(auth, 'members.remove') : can(auth, 'members.remove')
  if (!allowed) throw ApiError.forbidden('Your role does not allow this.')
  if (!rejecting) assertCanManage(auth, id, membership, 'remove')

  // A user belongs to one organization, so removing them deletes the account.
  // Foreign keys unassign their work items and end their sessions.
  await query('DELETE FROM users WHERE id = ?', [id])
  disconnectUser(id)

  broadcastToOrg(auth.organizationId, Events.WORKSPACE_CHANGED, { section: 'members' })
  broadcastToOrg(auth.organizationId, Events.WORK_ITEMS_CHANGED, { action: 'unassigned', userId: id })
}
