import type { BugResolution, BugSeverity, BugStatus } from '../../types'
import { resolutionLabels, severityLabels, severityStyles, statusLabels, statusStyles } from '../../utils/bugs'
import { cn } from '../../utils/format'

export function SeverityBadge({ severity, className }: { severity: BugSeverity; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-4 ring-1 ring-inset', severityStyles[severity], className)}>
      {severityLabels[severity]}
    </span>
  )
}

export function BugStatusPill({ status, resolution, className }: { status: BugStatus; resolution?: BugResolution | null; className?: string }) {
  const style = statusStyles[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', style.pill, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', style.dot)} />
      {statusLabels[status]}
      {resolution && resolution !== 'fixed' && <span className="opacity-75">· {resolutionLabels[resolution]}</span>}
    </span>
  )
}
