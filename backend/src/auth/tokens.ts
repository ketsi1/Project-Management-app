// Access tokens are HS256 JWTs. Each one carries a session id (`jti`) that must still be
// active in the auth_sessions table, so logging out or removing a member revokes it
// immediately instead of waiting for the token to expire.
import { createHash, randomBytes } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.ts'

const ISSUER = 'pm-backend'
const AUDIENCE = 'pm-frontend'

export interface TokenClaims {
  userId: string
  organizationId: string
  sessionId: string
}

export function signAccessToken({ userId, organizationId, sessionId }: TokenClaims): string {
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
export function verifyAccessToken(token: string): TokenClaims | null {
  try {
    const payload = jwt.verify(token, env.auth.jwtSecret, {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
    })
    if (typeof payload === 'string') return null
    const org: unknown = payload.org
    if (!payload.sub || !payload.jti || typeof org !== 'string' || !org) return null
    return { userId: payload.sub, organizationId: org, sessionId: payload.jti }
  } catch {
    return null
  }
}

// Invitation tokens are random strings; only their SHA-256 is stored in the database.
export function createInviteToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url')
  return { token, tokenHash: hashToken(token) }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
