import { createContext, useContext } from 'react'
import type { LoginInput, RegisterInput, RegisterResult, Session, ViewMode } from '../types'

export interface AuthContextValue {
  session: Session | null
  activeViewMode: ViewMode
  isManager: boolean
  login: (input: LoginInput) => Promise<void>
  // Creates a pending account. Does not log in: a manager must approve it first.
  register: (input: RegisterInput) => Promise<RegisterResult>
  logout: () => Promise<void>
}

// The shared "box" that holds the logged-in user. AuthProvider fills it.
export const AuthContext = createContext<AuthContextValue | null>(null)

// Any component calls useAuth() to read the session or log in/out.
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}
