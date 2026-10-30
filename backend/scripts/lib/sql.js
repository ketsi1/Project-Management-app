// Shared helpers for the database scripts: run the .sql files in ../database.
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'
import { env } from '../../src/config/env.js'

export const databaseDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../database')

// The SQL files say `pm_database`; swap in DB_NAME so another name works too.
if (!/^[A-Za-z0-9_]+$/.test(env.db.database)) {
  throw new Error('DB_NAME may only contain letters, numbers and underscores.')
}

export async function connect({ withDatabase = true } = {}) {
  return mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: withDatabase ? env.db.database : undefined,
    multipleStatements: true,
    charset: 'utf8mb4',
  })
}

export async function runSqlFile(connection, fileName) {
  const raw = await readFile(path.join(databaseDir, fileName), 'utf8')
  const sql = raw.replaceAll('pm_database', env.db.database)
  await connection.query(sql)
  console.info(`  ✓ ${fileName}`)
}

export async function runScript(name, work) {
  console.info(`${name} → ${env.db.user}@${env.db.host}:${env.db.port}/${env.db.database}`)
  try {
    await work()
    console.info('Done.')
  } catch (error) {
    console.error(`Failed: ${error.message}`)
    process.exitCode = 1
  }
}
