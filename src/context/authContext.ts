import { createContext, useContext } from 'react'
import type { LoginInput, RegisterInput, Session } from '../types'

export interface AuthContextValue {
  session: Session | null
  login: (input: LoginInput) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
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
