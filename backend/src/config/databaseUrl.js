// The MySQL connection settings, shared by the app (src/db/prisma.js) and the Prisma CLI
// (prisma.config.js). Reads backend/.env. DATABASE_URL wins when it is set; otherwise the URL is
// built from DB_HOST, DB_PORT, DB_USER, DB_PASSWORD and DB_NAME.
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const envFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env')
if (existsSync(envFile)) process.loadEnvFile(envFile)

const read = (name, fallback) => (process.env[name] === undefined || process.env[name] === '' ? fallback : process.env[name])

export const dbSettings = Object.freeze({
  host: read('DB_HOST', '127.0.0.1'),
  port: Number.parseInt(read('DB_PORT', '3306'), 10),
  user: read('DB_USER', 'root'),
  password: read('DB_PASSWORD', ''),
  database: read('DB_NAME', 'pm_database'),
  connectionLimit: Number.parseInt(read('DB_POOL_SIZE', '10'), 10),
})

export function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const { host, port, user, password, database } = dbSettings
  const auth = password ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}` : encodeURIComponent(user)
  return `mysql://${auth}@${host}:${port}/${database}`
}
