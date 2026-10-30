import { createServer } from 'node:http'
import { createApp } from './app.js'
import { env } from './config/env.js'
import { checkDatabase, pool } from './db/pool.js'
import { closeRealtime, initRealtime } from './realtime/socket.js'

async function main() {
  try {
    await checkDatabase()
  } catch (error) {
    console.error(
      `[startup] Cannot reach MySQL at ${env.db.user}@${env.db.host}:${env.db.port}/${env.db.database}: ${error.message}\n` +
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
  async function shutdown(signal) {
    if (shuttingDown) return
    shuttingDown = true
    console.info(`[shutdown] ${signal} received, closing connections...`)
    const forceExit = setTimeout(() => process.exit(1), 10_000)
    forceExit.unref()
    await closeRealtime()
    await new Promise((resolve) => httpServer.close(resolve))
    await pool.end()
    process.exit(0)
  }
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

main()
