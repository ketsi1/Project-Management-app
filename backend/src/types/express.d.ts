// Extra properties this backend puts on Express requests.
// - req.auth:  set by `authenticate` (middleware/auth.ts). Read it with authOf(req).
// - req.valid: set by `validate` (middleware/validate.ts). Read it with validated(req, schema).
import type { AuthContext } from '../auth/sessionStore.ts'

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext
      valid?: { body?: unknown; query?: unknown; params?: unknown }
    }
  }
}

export {}
