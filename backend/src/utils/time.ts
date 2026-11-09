import { randomUUID } from 'node:crypto'

export const newId = (): string => randomUUID()

type DateInput = Date | string | number

// Timestamps from the database arrive as Date objects; the frontend expects ISO strings.
export function toIso(value: DateInput): string
export function toIso(value: DateInput | null | undefined): string | null
export function toIso(value: DateInput | null | undefined): string | null {
  if (value === null || value === undefined) return null
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

// Due dates are plain calendar days. In the API they are 'YYYY-MM-DD' strings; Prisma reads
// and writes DATE columns as Date objects at midnight UTC.
export function toDateOnly(value: DateInput | null | undefined): string | null {
  if (value === null || value === undefined) return null
  return (value instanceof Date ? value : new Date(value)).toISOString().slice(0, 10)
}

export function fromDateOnly(value: string | null | undefined): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null
}

// A Date `days` from today (UTC), at midnight — for due dates.
export function daysFromToday(days: number): Date | null {
  return fromDateOnly(new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10))
}
