// Loads settings from the environment (and backend/.env if present) and checks them once at startup.
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const envFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env')
if (existsSync(envFile)) process.loadEnvFile(envFile)

function read(name, fallback) {
  const value = process.env[name]
  if (value === undefined || value === '') {
    if (fallback === undefined) throw new Error(`Missing required environment variable ${name}. See backend/.env.example.`)
    return fallback
  }
  return value
}

function readInt(name, fallback) {
  const value = Number.parseInt(read(name, String(fallback)), 10)
  if (Number.isNaN(value)) throw new Error(`Environment variable ${name} must be a number.`)
  return value
}

const nodeEnv = read('NODE_ENV', 'development')
const isProduction = nodeEnv === 'production'

const jwtSecret = read('JWT_SECRET', isProduction ? undefined : 'dev-only-insecure-secret-change-me-0123456789')
if (isProduction && jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production.')
}

export const env = Object.freeze({
  nodeEnv,
  isProduction,
  port: readInt('PORT', 4000),
  // Comma-separated list of browser origins allowed to call the API and open sockets.
  corsOrigins: read('CORS_ORIGIN', 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  // Set when the API runs behind a reverse proxy, so rate limiting sees real client IPs.
  trustProxy: read('TRUST_PROXY', 'false') === 'true',
  // Failed login/register attempts allowed per IP every 15 minutes.
  authRateLimit: readInt('AUTH_RATE_LIMIT', 20),

  db: {
    host: read('DB_HOST', '127.0.0.1'),
    port: readInt('DB_PORT', 3306),
    user: read('DB_USER', 'root'),
    password: read('DB_PASSWORD', ''),
    database: read('DB_NAME', 'pm_database'),
    connectionLimit: readInt('DB_POOL_SIZE', 10),
  },

  auth: {
    jwtSecret,
    tokenTtlSeconds: readInt('TOKEN_TTL_HOURS', 24 * 7) * 3600,
    bcryptRounds: readInt('BCRYPT_ROUNDS', 12),
    inviteTtlHours: readInt('INVITE_TTL_HOURS', 72),
  },

  // Where invited people set their password. The token is appended as ?token=...
  appUrl: read('APP_URL', 'http://localhost:5173'),
})
