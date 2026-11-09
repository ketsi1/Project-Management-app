import { randomBytes } from 'node:crypto'
import bcrypt from 'bcrypt'
import { env } from '../config/env.ts'

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env.auth.bcryptRounds)
}

// A hash of a random string, made once at startup with the same cost factor. Comparing
// against it when the email is unknown makes "no such user" take as long as
// "wrong password", so response timing reveals nothing.
let dummyHash: Promise<string> | undefined
function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(16).toString('hex'))
  return dummyHash
}

export async function verifyPassword(plain: string, hash: string | null | undefined): Promise<boolean> {
  if (!hash) {
    await bcrypt.compare(plain, await getDummyHash())
    return false
  }
  return bcrypt.compare(plain, hash)
}
