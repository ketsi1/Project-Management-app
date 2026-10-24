import { useEffect, useState, type ReactNode } from 'react'
import { api } from '../api'
import { clearSession, getStoredSession, storeSession } from '../api/session'
import { connectRealtime, disconnectRealtime } from '../realtime/socket'
import type { LoginInput, RegisterInput, Session } from '../types'
import { AuthContext } from './authContext'

// Wraps the app and gives every component access to the logged-in user.
export default function AuthProvider({ children }: { children: ReactNode }) {
  // Start with whatever session was saved last time, so a page refresh keeps you logged in.
  const [session, setSession] = useState<Session | null>(() => getStoredSession())

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

  return <AuthContext.Provider value={{ session, login, register, logout }}>{children}</AuthContext.Provider>
}
