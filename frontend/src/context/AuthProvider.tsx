import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../api'
import { ApiError } from '../api/ApiError'
import { clearSession, getStoredSession, storeSession } from '../api/session'
import { connectRealtime, disconnectRealtime, onRealtime } from '../realtime/socket'
import type { LoginInput, Permission, RegisterInput, Session, ViewMode } from '../types'
import { AuthContext } from './authContext'

// Wraps the app and gives every component access to the logged-in user and what their role allows.
export default function AuthProvider({ children }: { children: ReactNode }) {
  // Start with whatever session was saved last time, so a page refresh keeps you logged in.
  const [session, setSession] = useState<Session | null>(() => getStoredSession())

  // Sessions saved before roles had permissions have none until refreshSession() runs.
  const permissions = useMemo(() => session?.permissions ?? [], [session])
  const can = useCallback((permission: Permission) => permissions.includes(permission), [permissions])
  const canAny = useCallback((...wanted: Permission[]) => wanted.some((p) => permissions.includes(p)), [permissions])

  // The view comes from the role's permissions: roles that see everyone's tasks get the
  // manager view, everyone else their own workstation.
  const isManager = can('tasks.view_all')
  const activeViewMode: ViewMode = isManager ? 'manager' : 'employee'

  const startSession = useCallback((next: Session) => {
    storeSession(next)
    setSession(next)
  }, [])

  const endSession = useCallback(() => {
    clearSession()
    setSession(null)
  }, [])

  // Roles and permissions can change while someone is logged in: ask the server for the current ones.
  const refreshSession = useCallback(async () => {
    const stored = getStoredSession()
    if (!stored) return
    try {
      const info = await api.me()
      // Ignore the answer if the person logged out or switched account meanwhile.
      if (getStoredSession()?.token !== stored.token) return
      startSession({ ...stored, user: info.user, role: info.role, roleName: info.roleName, permissions: info.permissions })
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) endSession()
    }
  }, [startSession, endSession])

  const token = session?.token

  // Open the realtime connection while someone is logged in, refresh permissions once,
  // and again whenever members or roles change.
  useEffect(() => {
    if (!token) return
    connectRealtime(token)
    void refreshSession()
    const off = onRealtime('workspace:changed', () => void refreshSession())
    return () => {
      off()
      disconnectRealtime()
    }
  }, [token, refreshSession])

  async function login(input: LoginInput) {
    startSession(await api.login(input))
  }

  // Sign-up never logs in: the new account waits for a manager to approve it.
  async function register(input: RegisterInput) {
    return api.register(input)
  }

  async function logout() {
    try {
      await api.logout()
    } finally {
      endSession()
    }
  }

  return (
    <AuthContext.Provider
      value={{ session, activeViewMode, isManager, can, canAny, login, startSession, register, logout, refreshSession }}
    >
      {children}
    </AuthContext.Provider>
  )
}
