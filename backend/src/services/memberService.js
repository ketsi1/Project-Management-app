import { env } from '../config/env.js'
import { createInviteToken } from '../auth/tokens.js'
import { query, transaction } from '../db/pool.js'
import { Events } from '../realtime/events.js'
import { broadcastToOrg, disconnectUser } from '../realtime/socket.js'
import { ApiError } from '../utils/ApiError.js'
import { newId } from '../utils/time.js'

// Creates the account with no password and an invitation token. Until an email service is
// wired in, the activation link is printed to the server log.
export async function inviteMember(auth, { fullName, email, role }) {
  if (role === 'owner') throw ApiError.badRequest('An organization has one owner. Invite them as an admin instead.')

  const existing = await query('SELECT id FROM users WHERE email = ?', [email])
  if (existing.length > 0) throw ApiError.conflict('This email already has an account.')

  const userId = newId()
  const { token, tokenHash } = createInviteToken()
  const expiresAt = new Date(Date.now() + env.auth.inviteTtlHours * 3600 * 1000)

  try {
    await transaction(async (connection) => {
      await query(
        `INSERT INTO users (id, full_name, email, password_hash, invitation_token, invitation_expires_at)
         VALUES (?, ?, ?, NULL, ?, ?)`,
        [userId, fullName, email, tokenHash, expiresAt],
        connection,
      )
      await query(
        'INSERT INTO organization_members (id, organization_id, user_id, role) VALUES (?, ?, ?, ?)',
        [newId(), auth.organizationId, userId, role],
        connection,
      )
    })
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') throw ApiError.conflict('This email already has an account.')
    throw error
  }

  const link = `${env.appUrl.replace(/\/$/, '')}/accept-invite?token=${token}`
  console.info(`[invite] ${email} was invited by ${auth.user.email}. Activation link (valid ${env.auth.inviteTtlHours}h): ${link}`)

  broadcastToOrg(auth.organizationId, Events.WORKSPACE_CHANGED, { section: 'members' })
  return { id: userId, fullName, email, role }
}

// Lets a pending sign-up in. Only owners/admins reach this (see routes).
export async function approveMember(auth, id) {
  const result = await query(
    "UPDATE organization_members SET status = 'active' WHERE user_id = ? AND organization_id = ? AND status = 'pending'",
    [id, auth.organizationId],
  )
  if (result.affectedRows !== 1) throw ApiError.notFound('No pending sign-up found for this person.')
  broadcastToOrg(auth.organizationId, Events.WORKSPACE_CHANGED, { section: 'members' })
}

export async function removeMember(auth, id) {
  if (id === auth.userId) throw ApiError.badRequest('You cannot remove yourself.')

  const rows = await query(
    'SELECT role FROM organization_members WHERE user_id = ? AND organization_id = ?',
    [id, auth.organizationId],
  )
  if (rows.length === 0) throw ApiError.notFound('Member not found.')
  const { role } = rows[0]
  if (role === 'owner') throw ApiError.badRequest('The owner cannot be removed.')
  if (role === 'admin' && auth.role !== 'owner') throw ApiError.forbidden('Only the owner can remove an admin.')

  // A user belongs to one organization, so removing them deletes the account.
  // Foreign keys unassign their work items and end their sessions.
  await query('DELETE FROM users WHERE id = ?', [id])
  disconnectUser(id)

  broadcastToOrg(auth.organizationId, Events.WORKSPACE_CHANGED, { section: 'members' })
  broadcastToOrg(auth.organizationId, Events.WORK_ITEMS_CHANGED, { action: 'unassigned', userId: id })
}
