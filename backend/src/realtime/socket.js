// Socket.IO server. The frontend connects with io(url, { auth: { token } }); we check that
// token exactly like the HTTP middleware does, then put the socket in rooms for its
// organization, user and session so we can broadcast and disconnect precisely.
import { Server } from 'socket.io'
import { resolveToken } from '../auth/sessionStore.js'
import { env } from '../config/env.js'

let io = null

export const rooms = {
  org: (organizationId) => `org:${organizationId}`,
  user: (userId) => `user:${userId}`,
  session: (sessionId) => `session:${sessionId}`,
}

export function initRealtime(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.corsOrigins, credentials: true },
  })

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token
      const auth = typeof token === 'string' ? await resolveToken(token) : null
      if (!auth) return next(new Error('unauthorized'))
      socket.data.auth = auth
      next()
    } catch (error) {
      console.error('[socket] auth check failed', error)
      next(new Error('unauthorized'))
    }
  })

  io.on('connection', (socket) => {
    const { organizationId, userId, sessionId } = socket.data.auth
    socket.join([rooms.org(organizationId), rooms.user(userId), rooms.session(sessionId)])
  })

  return io
}

// Tells everyone in an organization that something changed. Payloads are small hints;
// the frontend reloads what it needs over HTTP, so permissions stay enforced there.
export function broadcastToOrg(organizationId, event, payload = {}) {
  io?.to(rooms.org(organizationId)).emit(event, payload)
}

export function disconnectSession(sessionId) {
  io?.in(rooms.session(sessionId)).disconnectSockets(true)
}

export function disconnectUser(userId) {
  io?.in(rooms.user(userId)).disconnectSockets(true)
}

export function closeRealtime() {
  return new Promise((resolve) => (io ? io.close(() => resolve()) : resolve()))
}
