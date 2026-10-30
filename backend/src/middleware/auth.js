import { resolveToken } from '../auth/sessionStore.js'
import { ApiError } from '../utils/ApiError.js'

// Requires "Authorization: Bearer <token>" and puts the caller on req.auth:
// { userId, organizationId, role, sessionId, user }.
export async function authenticate(req, _res, next) {
  const header = req.get('authorization') ?? ''
  const [scheme, token] = header.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) throw ApiError.unauthorized()

  const auth = await resolveToken(token)
  if (!auth) throw ApiError.unauthorized('Your session has expired. Please log in again.')

  req.auth = auth
  next()
}

// Allows the request only for the listed roles. Use after `authenticate`.
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      throw ApiError.forbidden('Only owners and admins can do this.')
    }
    next()
  }
}

export const requireManager = requireRole('owner', 'admin')
