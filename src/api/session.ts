import type { Session } from '../types'

// The key under which the logged-in session is saved in the browser.
const SESSION_KEY = 'pm-session'

export function getStoredSession(): Session | null {
  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as Session
  } catch {
    return null
  }
}

export function storeSession(session: Session): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
}
