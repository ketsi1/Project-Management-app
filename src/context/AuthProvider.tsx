import { useEffect, useState, type ReactNode } from 'react'
import { api } from '../api'
import { clearSession, getStoredSession, storeSession } from '../api/session'
import { connectRealtime, disconnectRealtime } from '../realtime/socket'
import type { LoginInput, RegisterInput, Session, ViewMode } from '../types'
import { AuthContext } from './authContext'

// Wraps the app and gives every component access to the logged-in user and their view.
export default function AuthProvider({ children }: { children: ReactNode }) {
  // Start with whatever session was saved last time, so a page refresh keeps you logged in.
  const [session, setSession] = useState<Session | null>(() => getStoredSession())

  const isManager = session?.role === 'owner' || session?.role === 'admin'
  // The view comes only from the role the server gave this login. There is no switch:
  // managers always get the manager view, employees always get the employee view.
  const activeViewMode: ViewMode = isManager ? 'manager' : 'employee'

  // Open the realtime connection while someone is logged in.
  useEffect(() => {
    if (!session) return
    connectRealtime(session.token)
    return () => disconnectRealtime()
  }, [session])

  async function login(input: LoginInput) {
    const result = await api.login(input)
    storeSession(result)
    setSession(result)
  }

  // Sign-up never logs in: the new account waits for a manager to approve it.
  async function register(input: RegisterInput) {
    return api.register(input)
  }

  async function logout() {
    try {
      await api.logout()
    } finally {
      clearSession()
      setSession(null)
    }
  }

  return (
    <AuthContext.Provider value={{ session, activeViewMode, isManager, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
