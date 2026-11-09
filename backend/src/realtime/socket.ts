// Socket.IO server. The frontend connects with io(url, { auth: { token } }); we check that
// token exactly like the HTTP middleware does, then put the socket in rooms for its
// organization, user and session so we can broadcast and disconnect precisely.
import type { Server as HttpServer } from 'node:http'
import { Server } from 'socket.io'
import { resolveToken, type AuthContext } from '../auth/sessionStore.ts'
import { env } from '../config/env.ts'
import type { EventName, EventPayload } from './events.ts'

// Server → client events: every event carries one small payload object.
type ServerToClientEvents = Record<EventName, (payload: EventPayload) => void>
// The client sends nothing; it only listens.
type ClientToServerEvents = Record<string, never>
type InterServerEvents = Record<string, never>
interface SocketData {
  auth: AuthContext
}

type RealtimeServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>

let io: RealtimeServer | null = null

export const rooms = {
  org: (organizationId: string) => `org:${organizationId}`,
  user: (userId: string) => `user:${userId}`,
  session: (sessionId: string) => `session:${sessionId}`,
}

export function initRealtime(httpServer: HttpServer): RealtimeServer {
  const server: RealtimeServer = new Server(httpServer, {
    cors: { origin: env.corsOrigins, credentials: true },
  })

  server.use(async (socket, next) => {
    try {
      const token: unknown = socket.handshake.auth?.token
      const auth = typeof token === 'string' ? await resolveToken(token) : null
      if (!auth) return next(new Error('unauthorized'))
      socket.data.auth = auth
      next()
    } catch (error) {
      console.error('[socket] auth check failed', error)
      next(new Error('unauthorized'))
    }
  })

  server.on('connection', (socket) => {
    const { organizationId, userId, sessionId } = socket.data.auth
    void socket.join([rooms.org(organizationId), rooms.user(userId), rooms.session(sessionId)])
  })

  io = server
  return server
}

// Tells everyone in an organization that something changed. Payloads are small hints;
// the frontend reloads what it needs over HTTP, so permissions stay enforced there.
export function broadcastToOrg(organizationId: string, event: EventName, payload: EventPayload = {}): void {
  io?.to(rooms.org(organizationId)).emit(event, payload)
}

export function disconnectSession(sessionId: string): void {
  io?.in(rooms.session(sessionId)).disconnectSockets(true)
}

export function disconnectUser(userId: string): void {
  io?.in(rooms.user(userId)).disconnectSockets(true)
}

export function closeRealtime(): Promise<void> {
  return new Promise((resolve) => (io ? io.close(() => resolve()) : resolve()))
}
