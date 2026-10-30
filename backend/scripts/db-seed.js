// Loads (or refreshes) the Acme Corp demo data. Safe to run repeatedly.
import { connect, runScript, runSqlFile } from './lib/sql.js'

await runScript('db:seed', async () => {
  const connection = await connect({ withDatabase: false })
  try {
    await runSqlFile(connection, 'seed.sql')
  } finally {
    await connection.end()
  }
})
