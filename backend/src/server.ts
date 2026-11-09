import { createServer } from 'node:http'
import { createApp } from './app.ts'
import { env } from './config/env.ts'
import { checkDatabase, closeDatabase } from './db/prisma.ts'
import { closeRealtime, initRealtime } from './realtime/socket.ts'

async function main(): Promise<void> {
  try {
    await checkDatabase()
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    console.error(
      `[startup] Cannot reach MySQL at ${env.db.user}@${env.db.host}:${env.db.port}/${env.db.database}: ${reason}\n` +
        'Check DB_* in backend/.env and that the schema is loaded (npm run db:setup).',
    )
    process.exit(1)
  }

  const httpServer = createServer(createApp())
  initRealtime(httpServer)

  httpServer.listen(env.port, () => {
    console.info(`[startup] API listening on http://localhost:${env.port}/api (sockets on http://localhost:${env.port})`)
    console.info(`[startup] Allowed origins: ${env.corsOrigins.join(', ')}`)
  })

  let shuttingDown = false
  async function shutdown(signal: NodeJS.Signals): Promise<void> {
    if (shuttingDown) return
    shuttingDown = true
    console.info(`[shutdown] ${signal} received, closing connections...`)
    const forceExit = setTimeout(() => process.exit(1), 10_000)
    forceExit.unref()
    await closeRealtime()
    await new Promise<void>((resolve) => httpServer.close(() => resolve()))
    await closeDatabase()
    process.exit(0)
  }
  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
}

void main()
