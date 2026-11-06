import { createContext, useContext } from 'react'
import type { LoginInput, Permission, RegisterInput, RegisterResult, Session, ViewMode } from '../types'

export interface AuthContextValue {
  session: Session | null
  activeViewMode: ViewMode
  // True when the role can see everyone's work ('tasks.view_all'): team dashboards and filters.
  isManager: boolean
  // Does the logged-in person's role have this permission? The backend checks the same.
  can: (permission: Permission) => boolean
  // Has at least one of these permissions.
  canAny: (...permissions: Permission[]) => boolean
  login: (input: LoginInput) => Promise<void>
  // Logs in with a session the server already created (e.g. after accepting an invitation).
  startSession: (session: Session) => void
  // Creates a pending account. Does not log in: a manager must approve it first.
  register: (input: RegisterInput) => Promise<RegisterResult>
  logout: () => Promise<void>
  // Re-reads the role and permissions from the server.
  refreshSession: () => Promise<void>
}

// The shared "box" that holds the logged-in user. AuthProvider fills it.
export const AuthContext = createContext<AuthContextValue | null>(null)

// Any component calls useAuth() to read the session or log in/out.
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}
