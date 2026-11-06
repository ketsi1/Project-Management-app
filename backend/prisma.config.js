// Prisma CLI settings: where the schema, migrations and seed script live, and how to reach MySQL.
// The connection comes from backend/.env (see src/config/databaseUrl.js).
import { defineConfig } from 'prisma/config'
import { databaseUrl } from './src/config/databaseUrl.js'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // Run by `prisma migrate reset` and `prisma db seed`: roles, permissions, accounts and demo data.
    seed: 'node prisma/seed/index.js all --with-demo',
  },
  datasource: {
    url: databaseUrl(),
  },
})
