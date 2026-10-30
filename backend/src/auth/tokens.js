// Access tokens are HS256 JWTs. Each one carries a session id (`jti`) that must still be
// active in the auth_sessions table, so logging out or removing a member revokes it
// immediately instead of waiting for the token to expire.
import { createHash, randomBytes } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'

const ISSUER = 'pm-backend'
const AUDIENCE = 'pm-frontend'

export function signAccessToken({ userId, organizationId, sessionId }) {
  return jwt.sign({ org: organizationId }, env.auth.jwtSecret, {
    algorithm: 'HS256',
    subject: userId,
    jwtid: sessionId,
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: env.auth.tokenTtlSeconds,
  })
}

// Returns { userId, organizationId, sessionId } or null when the token is invalid or expired.
export function verifyAccessToken(token) {
  try {
    const payload = jwt.verify(token, env.auth.jwtSecret, {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
    })
    if (!payload.sub || !payload.jti || !payload.org) return null
    return { userId: payload.sub, organizationId: payload.org, sessionId: payload.jti }
  } catch {
    return null
  }
}

// Invitation tokens are random strings; only their SHA-256 is stored in the database.
export function createInviteToken() {
  const token = randomBytes(32).toString('base64url')
  return { token, tokenHash: hashToken(token) }
}

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}
