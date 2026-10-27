import type { ReactNode } from 'react'
import type { Priority, Status } from '../../types'
import { pressable } from '../../utils/a11y'
import { cn, priorityLabels, priorityStyles } from '../../utils/format'
import Icon, { type IconName } from './Icon'

// Small, reusable display pieces so every page looks the same.

type Tone = 'indigo' | 'sky' | 'emerald' | 'rose' | 'amber' | 'violet' | 'slate'

const toneIcon: Record<Tone, string> = {
  indigo: 'bg-indigo-50 text-indigo-600 ring-indigo-100',
  sky: 'bg-sky-50 text-sky-600 ring-sky-100',
  emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  rose: 'bg-rose-50 text-rose-600 ring-rose-100',
  amber: 'bg-amber-50 text-amber-600 ring-amber-100',
  violet: 'bg-violet-50 text-violet-600 ring-violet-100',
  slate: 'bg-slate-50 text-slate-500 ring-slate-100',
}

const toneValue: Record<Tone, string> = {
  indigo: 'text-slate-900',
  sky: 'text-sky-700',
  emerald: 'text-emerald-600',
  rose: 'text-rose-600',
  amber: 'text-amber-600',
  violet: 'text-violet-700',
  slate: 'text-slate-900',
}

const toneBar: Record<Tone, string> = {
  indigo: 'bg-indigo-500',
  sky: 'bg-sky-500',
  emerald: 'bg-emerald-500',
  rose: 'bg-rose-500',
  amber: 'bg-amber-500',
  violet: 'bg-violet-500',
  slate: 'bg-slate-400',
}

// ── KPI tile ────────────────────────────────────────────────────────
interface StatCardProps {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon: IconName
  tone?: Tone
  onClick?: () => void
  active?: boolean
  children?: ReactNode
}

export function StatCard({ label, value, hint, icon, tone = 'indigo', onClick, active, children }: StatCardProps) {
  return (
    <div
      {...(onClick ? pressable(onClick) : {})}
      className={cn(
        'surface group flex flex-col p-4 sm:p-5',
        onClick && 'interactive-card',
        active && 'border-indigo-300 ring-2 ring-indigo-500/15',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-medium text-slate-500 sm:text-[13px]">{label}</span>
        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset', toneIcon[tone])}>
          <Icon name={icon} className="h-4 w-4" />
        </span>
      </div>
      <p className={cn('mt-2 text-2xl font-bold tabular-nums tracking-tight sm:text-3xl', toneValue[tone])}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {children}
      {onClick && (
        <span className="mt-auto flex items-center gap-1 pt-3 text-xs font-medium text-indigo-600 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 max-sm:hidden">
          View <Icon name="arrowRight" className="h-3 w-3" />
        </span>
      )}
    </div>
  )
}

// ── Dashboard welcome banner ───────────────────────────────────────
export function PageHero({
  eyebrow,
  title,
  description,
  actions,
  accent = 'indigo',
}: {
  eyebrow: string
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  accent?: 'indigo' | 'sky'
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-slate-950 p-5 text-white shadow-card sm:p-7 lg:p-8">
      <div
        className={cn(
          'pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full blur-3xl',
          accent === 'indigo' ? 'bg-indigo-600/35' : 'bg-sky-500/30',
        )}
      />
      <div className="pointer-events-none absolute -bottom-28 left-1/4 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '22px 22px' }}
      />

      <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0 space-y-2">
          <span
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ring-1 ring-inset',
              accent === 'indigo' ? 'bg-indigo-500/15 text-indigo-200 ring-indigo-400/25' : 'bg-sky-500/15 text-sky-200 ring-sky-400/25',
            )}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            {eyebrow}
          </span>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">{title}</h1>
          {description && <p className="max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-[15px]">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2 sm:gap-3 xl:shrink-0 xl:flex-nowrap">{actions}</div>}
      </div>
    </section>
  )
}

// ── Section title row ──────────────────────────────────────────────
export function SectionHeader({
  title,
  description,
  badge,
  action,
}: {
  title: ReactNode
  description?: ReactNode
  badge?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-slate-900 sm:text-lg">{title}</h2>
          {badge}
        </div>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

// ── Nothing-to-show placeholder ────────────────────────────────────
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: IconName
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <p className="mt-4 text-sm font-semibold text-slate-800">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

// ── Loading spinner ────────────────────────────────────────────────
export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={cn('animate-spin text-indigo-600', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-90" stroke="currentColor" strokeWidth="3" strokeLinecap="round" d="M22 12a10 10 0 0 0-10-10" />
    </svg>
  )
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 animate-fade-in" role="status">
      <Spinner className="h-7 w-7" />
      <p className="text-sm font-medium text-slate-500">{label}</p>
    </div>
  )
}

// ── Alerts ─────────────────────────────────────────────────────────
export function Alert({
  tone = 'error',
  children,
  action,
}: {
  tone?: 'error' | 'success'
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-3 rounded-xl border px-4 py-3 text-sm animate-fade-in-up',
        tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800',
      )}
    >
      <Icon name={tone === 'error' ? 'alert' : 'checkCircle'} className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1 font-medium">{children}</div>
      {action}
    </div>
  )
}

// ── Badges ─────────────────────────────────────────────────────────
export function PriorityBadge({ priority, suffix, className }: { priority: Priority; suffix?: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-4',
        priorityStyles[priority],
        className,
      )}
    >
      {priorityLabels[priority]}
      {suffix}
    </span>
  )
}

export function StatusPill({ status, className }: { status?: Status; className?: string }) {
  const color = status?.color ?? '#94a3b8'
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium', className)}
      style={{ backgroundColor: `${color}1a`, color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="truncate">{status?.name ?? '—'}</span>
    </span>
  )
}

export function OverdueBadge({ label = 'Overdue' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-1.5 py-0.5 text-[11px] font-semibold leading-4 text-rose-600 ring-1 ring-inset ring-rose-200">
      <Icon name="alert" className="h-3 w-3" />
      {label}
    </span>
  )
}

// ── Progress bar ───────────────────────────────────────────────────
export function ProgressBar({
  percent,
  tone = 'indigo',
  className,
  colorClass,
}: {
  percent: number
  tone?: Tone
  className?: string
  colorClass?: string
}) {
  const value = Math.max(0, Math.min(100, percent))
  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-slate-100', className)}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-700 ease-out-expo', colorClass ?? toneBar[tone])}
        style={{ width: `${value}%` }}
      />
    </div>
  )
}
