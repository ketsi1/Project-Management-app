// Accounts created by the seeders (`npm run seed`), and the demo accounts from prisma/seed/demo.ts.
// Every value can be overridden in backend/.env. The login page lists these as one-click
// logins while SHOW_DEMO_ACCOUNTS is on (the default outside production).
import { env } from './env.ts'

const read = (name: string, fallback: string): string => {
  const value = process.env[name]
  return value === undefined || value === '' ? fallback : value
}

export interface SeedAccount {
  key: string
  roleSlug: string
  fullName: string
  email: string
  password: string
}

export const seedOrganizationName = read('SEED_ORG_NAME', 'Acme Corp')

// Created by `npm run seed:admin` and `npm run seed:users`.
export const seededAccounts: SeedAccount[] = [
  {
    key: 'admin',
    roleSlug: 'admin',
    fullName: read('SEED_ADMIN_NAME', 'System Admin'),
    email: read('SEED_ADMIN_EMAIL', 'admin@acme.com').toLowerCase(),
    password: read('SEED_ADMIN_PASSWORD', 'Admin@12345'),
  },
  {
    key: 'manager',
    roleSlug: 'manager',
    fullName: read('SEED_MANAGER_NAME', 'Maya Manager'),
    email: read('SEED_MANAGER_EMAIL', 'manager@acme.com').toLowerCase(),
    password: read('SEED_MANAGER_PASSWORD', 'Manager@12345'),
  },
  {
    key: 'member',
    roleSlug: 'member',
    fullName: read('SEED_MEMBER_NAME', 'Mike Member'),
    email: read('SEED_MEMBER_EMAIL', 'member@acme.com').toLowerCase(),
    password: read('SEED_MEMBER_PASSWORD', 'Member@12345'),
  },
]

// The seeded admin account (always present in the list above).
export const seededAdmin: SeedAccount = seededAccounts[0]!

// Created by the demo seeder (`npm run seed:demo`). Listed for one-click login only.
export const demoAccounts: SeedAccount[] = [
  { key: 'owner', roleSlug: 'owner', fullName: 'Alex Morgan', email: 'alex@acme.com', password: '87654321' },
  { key: 'sarah', roleSlug: 'member', fullName: 'Sarah Connor', email: 'sarah@acme.com', password: '12345678' },
]

// Off in production unless explicitly turned on: it shows passwords on the login page.
export const showDemoAccounts = read('SHOW_DEMO_ACCOUNTS', env.isProduction ? 'false' : 'true') === 'true'
