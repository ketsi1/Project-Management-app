import { useEffect, useState, type ReactNode } from 'react'
import { api } from '../api'
import { clearSession, getStoredSession, storeSession } from '../api/session'
import { connectRealtime, disconnectRealtime } from '../realtime/socket'
import type { LoginInput, RegisterInput, Session, ViewMode } from '../types'
import { AuthContext } from './authContext'

// Wraps the app and gives every component access to the logged-in user and active role view.
export default function AuthProvider({ children }: { children: ReactNode }) {
  // Start with whatever session was saved last time, so a page refresh keeps you logged in.
  const [session, setSession] = useState<Session | null>(() => getStoredSession())
  const [managerViewPreference, setManagerViewPreference] = useState<ViewMode>(() => {
    return (localStorage.getItem('pm-view-mode') as ViewMode) || 'manager'
  })

  const isManager = session?.role === 'owner' || session?.role === 'admin'
  // Non-managers (employees) are always in 'employee' view mode.
  // Managers can toggle between 'manager' and 'employee' view modes.
  const activeViewMode: ViewMode = !isManager ? 'employee' : managerViewPreference

  function setActiveViewMode(mode: ViewMode) {
    if (isManager) {
      setManagerViewPreference(mode)
      localStorage.setItem('pm-view-mode', mode)
    }
  }

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

  async function register(input: RegisterInput) {
    const result = await api.register(input)
    storeSession(result)
    setSession(result)
  }

  async function logout() {
    try {
      await api.logout()
    } finally {
      clearSession()
      setSession(null)
    }
  }

  async function switchDemoUser(email: string) {
    const result = await api.login({ email, password: 'password123' })
    storeSession(result)
    setSession(result)
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        activeViewMode,
        setActiveViewMode,
        isManager,
        login,
        register,
        logout,
        switchDemoUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
