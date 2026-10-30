// Applies database/migrations/*.sql that have not run yet, in file-name order.
// Use this on a database that already has data; it never drops anything.
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { connect, databaseDir, runScript, runSqlFile } from './lib/sql.js'

export async function ensureMigrationsTable(connection) {
  await connection.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name VARCHAR(255) NOT NULL PRIMARY KEY,
       applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  )
}

async function migrate() {
  const connection = await connect()
  try {
    await ensureMigrationsTable(connection)
    const [rows] = await connection.query('SELECT name FROM schema_migrations')
    const applied = new Set(rows.map((row) => row.name))
    const files = (await readdir(path.join(databaseDir, 'migrations'))).filter((f) => f.endsWith('.sql')).sort()

    const pending = files.filter((file) => !applied.has(file))
    if (pending.length === 0) console.info('  Nothing to migrate.')
    for (const file of pending) {
      await runSqlFile(connection, path.join('migrations', file))
      await connection.query('INSERT INTO schema_migrations (name) VALUES (?)', [file])
    }
  } finally {
    await connection.end()
  }
}

// Only run when called directly (db-setup.js imports ensureMigrationsTable).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runScript('db:migrate', migrate)
}
