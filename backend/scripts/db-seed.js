// Loads (or refreshes) the Acme Corp demo data, then fills in role permissions. Safe to run repeatedly.
// Same as `npm run seed:demo`.
import { connect, runScript } from './lib/sql.js'
import { seedDemo } from './seed/index.js'

await runScript('db:seed', async () => {
  const connection = await connect()
  try {
    await seedDemo(connection)
  } finally {
    await connection.end()
  }
})
process.exit(process.exitCode ?? 0)
