import { randomUUID } from 'node:crypto'

export const newId = () => randomUUID()

// MySQL TIMESTAMP values arrive as Date objects; the frontend expects ISO strings.
export function toIso(value) {
  if (value === null || value === undefined) return null
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

// 'YYYY-MM-DD' for a date `days` from today (UTC).
export function daysFromToday(days) {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)
}
