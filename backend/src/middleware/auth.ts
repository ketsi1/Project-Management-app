import type { NextFunction, Request, RequestHandler, Response } from 'express'
import type { PermissionKey } from '../auth/permissions.ts'
import { resolveToken, type AuthContext } from '../auth/sessionStore.ts'
import { ApiError } from '../utils/ApiError.ts'

// Requires "Authorization: Bearer <token>" and puts the caller on req.auth:
// { userId, organizationId, role, roleId, roleName, permissions, sessionId, user }.
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.get('authorization') ?? ''
  const [scheme, token] = header.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) throw ApiError.unauthorized()

  const auth = await resolveToken(token)
  if (!auth) throw ApiError.unauthorized('Your session has expired. Please log in again.')

  req.auth = auth
  next()
}

// The caller on a route behind `authenticate`. Throws 401 if the route forgot the middleware.
export function authOf(req: Request): AuthContext {
  if (!req.auth) throw ApiError.unauthorized()
  return req.auth
}

// True when the caller's role has the permission (see auth/permissions.ts for the list).
// Accepts any string because some keys come from the database (e.g. another role's permissions).
export const can = (auth: AuthContext | undefined, permission: PermissionKey | string): boolean =>
  !!auth?.permissions.includes(permission)

// Allows the request only when the caller's role has every listed permission. Use after `authenticate`.
export function requirePermission(...permissions: PermissionKey[]): RequestHandler {
  return (req, _res, next) => {
    if (!permissions.every((permission) => can(req.auth, permission))) {
      throw ApiError.forbidden('Your role does not allow this.')
    }
    next()
  }
}
