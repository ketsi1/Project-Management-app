import type { Priority, Status, StatusCategory, WorkItem } from '../types'

// Joins class names, skipping empty ones: cn('a', false && 'b', 'c') → 'a c'
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

// '2026-10-30' → 'Oct 30, 2026'
export function formatDate(date: string | null): string {
  if (!date) return '—'
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function categoryOf(item: WorkItem, statuses: Status[]): StatusCategory | undefined {
  return statuses.find((s) => s.id === item.statusId)?.category
}

// Overdue = due date passed and the item is not finished or cancelled.
export function isOverdue(item: WorkItem, statuses: Status[]): boolean {
  if (!item.dueDate) return false
  const category = categoryOf(item, statuses)
  if (category === 'done' || category === 'cancelled') return false
  return item.dueDate < todayIso()
}

// Completion = done items ÷ items that are not cancelled.
export function completion(items: WorkItem[], statuses: Status[]): { done: number; total: number; percent: number } {
  const eligible = items.filter((item) => categoryOf(item, statuses) !== 'cancelled')
  const done = eligible.filter((item) => categoryOf(item, statuses) === 'done').length
  const total = eligible.length
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) }
}

export const priorityLabels: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
}

export const priorityStyles: Record<Priority, string> = {
  low: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200',
  medium: 'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200',
  high: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  urgent: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200',
}

export const categoryLabels: Record<StatusCategory, string> = {
  not_started: 'Not started',
  active: 'Active',
  done: 'Done',
  cancelled: 'Cancelled',
}

// 'Samuel Akalewold' → 'SA'
export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}
