// The one Prisma Client the whole backend shares. It talks to MySQL through the MariaDB driver
// adapter (Prisma 7 runs queries in JavaScript, without a separate engine binary).
//
// Generated code lives in src/generated/prisma (run `npm run db:generate` after editing
// prisma/schema.prisma; `npm install` does it too).
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { PrismaClient, type Prisma } from '../generated/prisma/client.ts'
import { dbSettings } from '../config/databaseUrl.ts'

export { Prisma } from '../generated/prisma/client.ts'

const adapter = new PrismaMariaDb({
  host: dbSettings.host,
  port: dbSettings.port,
  user: dbSettings.user,
  password: dbSettings.password,
  database: dbSettings.database,
  connectionLimit: dbSettings.connectionLimit,
  // Read and write TIMESTAMP columns in UTC, so times never shift with the server's time zone.
  timezone: 'Z',
  // MySQL 8 with caching_sha2_password over a plain local connection needs this.
  allowPublicKeyRetrieval: true,
})

export const prisma = new PrismaClient({ adapter })

// Either the shared client or the client inside prisma.$transaction(async (tx) => ...).
// Functions that take `db: Db` work in both, so they can join a caller's transaction.
export type Db = PrismaClient | Prisma.TransactionClient

export async function checkDatabase(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`
}

export async function closeDatabase(): Promise<void> {
  await prisma.$disconnect()
}

// Prisma error code for "a unique constraint failed" (e.g. the email already exists).
export const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
