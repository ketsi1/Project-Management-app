import type { BugResolution, BugSeverity, BugStatus } from '../types'

// Labels and colors for bug fields, shared by the bug list and detail pages.

export const severityLabels: Record<BugSeverity, string> = {
  critical: 'Critical',
  major: 'Major',
  minor: 'Minor',
  trivial: 'Trivial',
}

export const severityHints: Record<BugSeverity, string> = {
  critical: 'Blocks work or loses data, no workaround',
  major: 'Important feature broken, workaround is painful',
  minor: 'Something is wrong but easy to work around',
  trivial: 'Cosmetic: typos, spacing, colors',
}

export const severityStyles: Record<BugSeverity, string> = {
  critical: 'bg-rose-600 text-white ring-rose-600',
  major: 'bg-orange-50 text-orange-700 ring-orange-200',
  minor: 'bg-amber-50 text-amber-700 ring-amber-200',
  trivial: 'bg-slate-100 text-slate-600 ring-slate-200',
}

export const severityOrder: BugSeverity[] = ['critical', 'major', 'minor', 'trivial']

export const statusLabels: Record<BugStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
}

export const statusStyles: Record<BugStatus, { pill: string; dot: string }> = {
  open: { pill: 'bg-rose-50 text-rose-700 ring-rose-200', dot: 'bg-rose-500' },
  in_progress: { pill: 'bg-sky-50 text-sky-700 ring-sky-200', dot: 'bg-sky-500' },
  resolved: { pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  closed: { pill: 'bg-slate-100 text-slate-600 ring-slate-200', dot: 'bg-slate-400' },
}

export const statusOrder: BugStatus[] = ['open', 'in_progress', 'resolved', 'closed']

export const resolutionLabels: Record<BugResolution, string> = {
  fixed: 'Fixed',
  wont_fix: 'Won’t fix',
  duplicate: 'Duplicate',
  cannot_reproduce: 'Cannot reproduce',
  by_design: 'By design',
}

export const isFinished = (status: BugStatus) => status === 'resolved' || status === 'closed'

// '2026-11-06T10:00:00Z' → '3h ago' / 'Nov 6'
export function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
