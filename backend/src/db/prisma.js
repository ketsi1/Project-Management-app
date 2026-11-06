// The one Prisma Client the whole backend shares. It talks to MySQL through the MariaDB driver
// adapter (Prisma 7 runs queries in JavaScript, without a separate engine binary).
//
// Generated code lives in src/generated/prisma (run `npm run db:generate` after editing
// prisma/schema.prisma; `npm install` does it too). Node 24 runs the generated .ts directly.
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { PrismaClient } from '../generated/prisma/client.ts'
import { dbSettings } from '../config/databaseUrl.js'

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

export async function checkDatabase() {
  await prisma.$queryRaw`SELECT 1`
}

export async function closeDatabase() {
  await prisma.$disconnect()
}

// Prisma error code for "a unique constraint failed" (e.g. the email already exists).
export const isUniqueViolation = (error) => error?.code === 'P2002'
