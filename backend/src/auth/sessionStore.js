// Login sessions (one row per issued token).
import { env } from '../config/env.js'
import { prisma } from '../db/prisma.js'
import { newId } from '../utils/time.js'
import { signAccessToken, verifyAccessToken } from './tokens.js'

// `db` can be a transaction client, so a session can be created together with other changes.
export async function createSession({ userId, organizationId, userAgent, ip }, db = prisma) {
  const sessionId = newId()
  await db.authSession.create({
    data: {
      id: sessionId,
      userId,
      organizationId,
      userAgent: userAgent?.slice(0, 255) ?? null,
      ipAddress: ip?.slice(0, 45) ?? null,
      expiresAt: new Date(Date.now() + env.auth.tokenTtlSeconds * 1000),
    },
  })
  return signAccessToken({ userId, organizationId, sessionId })
}

export async function revokeSession(sessionId) {
  await prisma.authSession.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } })
}

// Checks the token's signature, then that its session is still active and the user is still
// an approved (active) member of the organization. Returns the caller's identity and *current* role
// and permissions (read on every request, so role changes apply immediately), or null.
export async function resolveToken(token) {
  const claims = verifyAccessToken(token)
  if (!claims) return null

  const session = await prisma.authSession.findFirst({
    where: {
      id: claims.sessionId,
      userId: claims.userId,
      organizationId: claims.organizationId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          memberships: {
            where: { organizationId: claims.organizationId, status: 'active' },
            select: {
              role: {
                select: {
                  id: true,
                  slug: true,
                  name: true,
                  permissions: { select: { permission: { select: { key: true } } } },
                },
              },
            },
          },
        },
      },
    },
  })
  const membership = session?.user.memberships[0]
  if (!membership) return null

  const { user } = session
  return {
    sessionId: claims.sessionId,
    userId: user.id,
    organizationId: claims.organizationId,
    role: membership.role.slug,
    roleId: membership.role.id,
    roleName: membership.role.name,
    permissions: membership.role.permissions.map((p) => p.permission.key).sort(),
    user: { id: user.id, fullName: user.fullName, email: user.email },
  }
}
