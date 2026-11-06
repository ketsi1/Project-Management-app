import { resolveToken } from '../auth/sessionStore.js'
import { ApiError } from '../utils/ApiError.js'

// Requires "Authorization: Bearer <token>" and puts the caller on req.auth:
// { userId, organizationId, role, roleId, roleName, permissions, sessionId, user }.
export async function authenticate(req, _res, next) {
  const header = req.get('authorization') ?? ''
  const [scheme, token] = header.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) throw ApiError.unauthorized()

  const auth = await resolveToken(token)
  if (!auth) throw ApiError.unauthorized('Your session has expired. Please log in again.')

  req.auth = auth
  next()
}

// True when the caller's role has the permission (see auth/permissions.js for the list).
export const can = (auth, permission) => !!auth?.permissions?.includes(permission)

// Allows the request only when the caller's role has every listed permission. Use after `authenticate`.
export function requirePermission(...permissions) {
  return (req, _res, next) => {
    if (!permissions.every((permission) => can(req.auth, permission))) {
      throw ApiError.forbidden('Your role does not allow this.')
    }
    next()
  }
}
