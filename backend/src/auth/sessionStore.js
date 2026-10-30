// Database access for login sessions (one row per issued token).
import { env } from '../config/env.js'
import { query } from '../db/pool.js'
import { newId } from '../utils/time.js'
import { signAccessToken, verifyAccessToken } from './tokens.js'

export async function createSession({ userId, organizationId, userAgent, ip }, connection) {
  const sessionId = newId()
  const expiresAt = new Date(Date.now() + env.auth.tokenTtlSeconds * 1000)
  await query(
    `INSERT INTO auth_sessions (id, user_id, organization_id, user_agent, ip_address, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [sessionId, userId, organizationId, userAgent?.slice(0, 255) ?? null, ip?.slice(0, 45) ?? null, expiresAt],
    connection,
  )
  return signAccessToken({ userId, organizationId, sessionId })
}

export async function revokeSession(sessionId) {
  await query('UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND revoked_at IS NULL', [sessionId])
}

// Checks the token's signature, then that its session is still active and the user is still
// an approved (active) member of the organization. Returns the caller's identity and *current* role, or null.
export async function resolveToken(token) {
  const claims = verifyAccessToken(token)
  if (!claims) return null

  const rows = await query(
    `SELECT u.id AS userId, u.full_name AS fullName, u.email, m.organization_id AS organizationId, m.role
       FROM auth_sessions s
       JOIN users u ON u.id = s.user_id
       JOIN organization_members m ON m.user_id = s.user_id AND m.organization_id = s.organization_id
      WHERE s.id = ? AND s.user_id = ? AND s.organization_id = ?
        AND m.status = 'active'
        AND s.revoked_at IS NULL AND s.expires_at > CURRENT_TIMESTAMP`,
    [claims.sessionId, claims.userId, claims.organizationId],
  )
  if (rows.length === 0) return null

  const row = rows[0]
  return {
    sessionId: claims.sessionId,
    userId: row.userId,
    organizationId: row.organizationId,
    role: row.role,
    user: { id: row.userId, fullName: row.fullName, email: row.email },
  }
}
