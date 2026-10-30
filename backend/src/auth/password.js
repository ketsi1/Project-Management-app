import { randomBytes } from 'node:crypto'
import bcrypt from 'bcrypt'
import { env } from '../config/env.js'

export function hashPassword(plain) {
  return bcrypt.hash(plain, env.auth.bcryptRounds)
}

// A hash of a random string, made once at startup with the same cost factor. Comparing
// against it when the email is unknown makes "no such user" take as long as
// "wrong password", so response timing reveals nothing.
let dummyHash
function getDummyHash() {
  dummyHash ??= hashPassword(randomBytes(16).toString('hex'))
  return dummyHash
}

export async function verifyPassword(plain, hash) {
  if (!hash) {
    await bcrypt.compare(plain, await getDummyHash())
    return false
  }
  return bcrypt.compare(plain, hash)
}
