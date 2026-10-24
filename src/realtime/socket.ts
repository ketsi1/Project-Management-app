// ---------------------------------------------------------------------------
// REALTIME (WebSockets)
// Connects to your backend's Socket.IO server so boards update live when a
// teammate changes something. It stays switched off until VITE_SOCKET_URL is
// set in .env, so the app works fine without a backend.
// ---------------------------------------------------------------------------
import { io, type Socket } from 'socket.io-client'

type Handler = () => void

let socket: Socket | null = null

// Remembers who wants which event, even before the connection exists.
const listeners = new Map<string, Set<Handler>>()

export function connectRealtime(token: string): void {
  const url = import.meta.env.VITE_SOCKET_URL as string | undefined
  if (!url || socket) return

  // The token lets the server know who is connecting and which organization they belong to.
  socket = io(url, { auth: { token } })

  // Attach every listener that registered before we connected.
  listeners.forEach((handlers, event) => {
    handlers.forEach((handler) => socket?.on(event, handler))
  })
}

export function disconnectRealtime(): void {
  socket?.disconnect()
  socket = null
}

// Subscribe to an event. Returns a function that unsubscribes again.
export function onRealtime(event: string, handler: Handler): () => void {
  if (!listeners.has(event)) listeners.set(event, new Set())
  listeners.get(event)?.add(handler)
  socket?.on(event, handler)

  return () => {
    listeners.get(event)?.delete(handler)
    socket?.off(event, handler)
  }
}
