// Creates the database from scratch: schema.sql, then seed.sql, then marks every
// migration as applied (schema.sql already contains them).
// WARNING: schema.sql drops and recreates every table, so existing data is lost.
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { connect, databaseDir, runScript, runSqlFile } from './lib/sql.js'
import { ensureMigrationsTable } from './db-migrate.js'

await runScript('db:setup', async () => {
  const connection = await connect({ withDatabase: false })
  try {
    await runSqlFile(connection, 'schema.sql')
    await runSqlFile(connection, 'seed.sql')

    await ensureMigrationsTable(connection)
    const files = (await readdir(path.join(databaseDir, 'migrations'))).filter((f) => f.endsWith('.sql')).sort()
    for (const file of files) {
      await connection.query('INSERT IGNORE INTO schema_migrations (name) VALUES (?)', [file])
    }
  } finally {
    await connection.end()
  }
})
