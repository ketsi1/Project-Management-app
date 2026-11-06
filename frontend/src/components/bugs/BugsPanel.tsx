import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useAuth } from '../../context/authContext'
import { useWorkspace } from '../../context/workspaceContext'
import type { Bug, BugStatus } from '../../types'
import { isFinished, severityLabels, severityOrder, statusLabels, timeAgo } from '../../utils/bugs'
import { cn } from '../../utils/format'
import Avatar from '../ui/Avatar'
import Button from '../ui/Button'
import { Alert, EmptyState, LoadingState, StatCard } from '../ui/Display'
import Icon from '../ui/Icon'
import { BugStatusPill, SeverityBadge } from './BugBadges'
import BugFormModal from './BugFormModal'

type StatusTab = 'active' | 'all' | BugStatus

const tabs: Array<{ id: StatusTab; label: string; match: (b: Bug) => boolean }> = [
  { id: 'active', label: 'Active', match: (b) => !isFinished(b.status) },
  { id: 'open', label: statusLabels.open, match: (b) => b.status === 'open' },
  { id: 'in_progress', label: statusLabels.in_progress, match: (b) => b.status === 'in_progress' },
  { id: 'resolved', label: statusLabels.resolved, match: (b) => b.status === 'resolved' },
  { id: 'closed', label: statusLabels.closed, match: (b) => b.status === 'closed' },
  { id: 'all', label: 'All', match: () => true },
]

interface BugsPanelProps {
  bugs: Bug[]
  loading: boolean
  error: string
  // Opens a bug's details (the Tasks page shows them in a drawer).
  onOpen: (bugId: string) => void
}

// Every bug the person may see, with filters. Critical, unfinished bugs come first.
// Shown on the Tasks page's Bugs filter.
export default function BugsPanel({ bugs, loading, error, onOpen }: BugsPanelProps) {
  const { session, can } = useAuth()
  const { workspace, projects } = useWorkspace()
  const [params, setParams] = useSearchParams()
  const me = session?.user.id

  const [tab, setTab] = useState<StatusTab>('active')
  const [search, setSearch] = useState('')
  const [severity, setSeverity] = useState('')
  const [assignee, setAssignee] = useState('')
  const [reporting, setReporting] = useState(false)
  // Fixed when the page opens, so "this week" doesn't shift while rendering.
  const [openedAt] = useState(() => Date.now())
  const projectId = params.get('project') ?? ''

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const memberName = (id: string | null) => (id ? (workspace.members.find((m) => m.id === id)?.fullName ?? 'Former member') : null)
  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? '—'

  // Everything except the status tab, so tab counts reflect the other filters.
  const baseFiltered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return bugs.filter((b) => {
      if (q && !b.title.toLowerCase().includes(q) && !b.key.toLowerCase().includes(q)) return false
      if (projectId && b.projectId !== projectId) return false
      if (severity && b.severity !== severity) return false
      if (assignee === 'me' && b.assigneeId !== me) return false
      if (assignee === 'reported' && b.reporterId !== me) return false
      if (assignee === 'none' && b.assigneeId) return false
      if (assignee && !['me', 'reported', 'none'].includes(assignee) && b.assigneeId !== assignee) return false
      return true
    })
  }, [bugs, search, projectId, severity, assignee, me])

  const currentTab = tabs.find((t) => t.id === tab)!
  const rank = (b: Bug) => (isFinished(b.status) ? 10 : 0) + severityOrder.indexOf(b.severity)
  const visible = baseFiltered.filter(currentTab.match).sort((a, b) => rank(a) - rank(b) || b.number - a.number)

  const active = bugs.filter((b) => !isFinished(b.status))
  const stats = {
    open: active.length,
    critical: active.filter((b) => b.severity === 'critical').length,
    mine: active.filter((b) => b.assigneeId === me).length,
    resolvedThisWeek: bugs.filter((b) => b.resolvedAt && openedAt - new Date(b.resolvedAt).getTime() < 7 * 86_400_000).length,
  }

  const hasFilters = Boolean(search || projectId || severity || assignee)
  const select = 'input-sm font-medium text-slate-700'

  if (loading) return <LoadingState label="Loading bugs…" />

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-500">
            {can('bugs.view_all') ? 'Every reported bug across the organization.' : 'Bugs you reported, bugs assigned to you, and bugs in your projects.'}
          </p>
        </div>
        {can('bugs.report') && (
          <Button onClick={() => setReporting(true)}>
            <Icon name="plus" className="h-4 w-4" />
            Report a bug
          </Button>
        )}
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Active bugs" value={stats.open} icon="bug" tone="rose" hint="Open or in progress" onClick={() => { setTab('active'); setSeverity(''); setAssignee('') }} />
        <StatCard label="Critical" value={stats.critical} icon="alert" tone={stats.critical > 0 ? 'rose' : 'slate'} hint="Active and critical" onClick={() => { setTab('active'); setSeverity('critical') }} />
        <StatCard label="Assigned to me" value={stats.mine} icon="user" tone="sky" hint="Waiting on you" onClick={() => { setTab('active'); setAssignee('me') }} />
        <StatCard label="Resolved this week" value={stats.resolvedThisWeek} icon="checkCircle" tone="emerald" hint="Last 7 days" onClick={() => setTab('resolved')} />
      </div>

      <div className="surface overflow-hidden">
        {/* Status tabs */}
        <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-slate-100 px-3 pt-2" role="tablist" aria-label="Bug status">
          {tabs.map((t) => {
            const count = baseFiltered.filter(t.match).length
            const selected = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(t.id)}
                className={cn(
                  'relative flex items-center gap-1.5 whitespace-nowrap px-3 pt-1.5 pb-2.5 text-sm font-medium transition-colors',
                  selected ? 'text-indigo-700 after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-indigo-600' : 'text-slate-500 hover:text-slate-900',
                )}
              >
                {t.label}
                <span className={cn('rounded-full px-1.5 text-[11px] tabular-nums', selected ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500')}>{count}</span>
              </button>
            )
          })}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <div className="relative min-w-[12rem] flex-1">
            <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title or BUG-number…" aria-label="Search bugs" className="input-sm w-full pl-9" />
          </div>
          <select value={projectId} onChange={(e) => setParam('project', e.target.value)} className={select} aria-label={workspace.terminology.project}>
            <option value="">All {workspace.terminology.projects.toLowerCase()}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select value={severity} onChange={(e) => setSeverity(e.target.value)} className={select} aria-label="Severity">
            <option value="">Any severity</option>
            {severityOrder.map((s) => (
              <option key={s} value={s}>
                {severityLabels[s]}
              </option>
            ))}
          </select>
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={select} aria-label="Assignee">
            <option value="">Anyone</option>
            <option value="me">Assigned to me</option>
            <option value="reported">Reported by me</option>
            <option value="none">Unassigned</option>
            {workspace.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.fullName}
              </option>
            ))}
          </select>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setSeverity('')
                setAssignee('')
                setParam('project', '')
              }}
              className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Clear
            </button>
          )}
        </div>

        {visible.length === 0 ? (
          <EmptyState
            icon={bugs.length === 0 ? 'bug' : 'inbox'}
            title={bugs.length === 0 ? 'No bugs reported yet' : 'No bugs match'}
            description={bugs.length === 0 ? 'When something breaks, report it here so it gets fixed.' : 'Try another tab or clear the filters.'}
            action={bugs.length === 0 && can('bugs.report') ? <Button onClick={() => setReporting(true)}>Report the first bug</Button> : undefined}
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {visible.map((bug) => {
              const assigneeName = memberName(bug.assigneeId)
              return (
                <li key={bug.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(bug.id)}
                    className="group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none sm:items-center"
                  >
                    <span className="mt-0.5 w-16 shrink-0 font-mono text-xs font-semibold text-slate-400 group-hover:text-indigo-600 sm:mt-0">{bug.key}</span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-sm font-medium', isFinished(bug.status) ? 'text-slate-500' : 'text-slate-900')}>{bug.title}</span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500">
                        {projectName(bug.projectId)} · reported by {memberName(bug.reporterId) ?? 'someone'} · updated {timeAgo(bug.updatedAt)}
                      </span>
                      {/* Badges move under the title on phones */}
                      <span className="mt-1.5 flex flex-wrap items-center gap-1.5 sm:hidden">
                        <SeverityBadge severity={bug.severity} />
                        <BugStatusPill status={bug.status} resolution={bug.resolution} />
                      </span>
                    </span>
                    <span className="hidden shrink-0 items-center gap-2 sm:flex">
                      <SeverityBadge severity={bug.severity} />
                      <BugStatusPill status={bug.status} resolution={bug.resolution} />
                    </span>
                    <span className="hidden w-10 shrink-0 items-center justify-end gap-1 text-xs text-slate-400 tabular-nums md:flex" title={`${bug.commentCount} comments`}>
                      {bug.commentCount > 0 && (
                        <>
                          <Icon name="message" className="h-3.5 w-3.5" />
                          {bug.commentCount}
                        </>
                      )}
                    </span>
                    <span className="shrink-0" title={assigneeName ? `Assigned to ${assigneeName}` : 'Unassigned'}>
                      {assigneeName ? (
                        <Avatar name={assigneeName} />
                      ) : (
                        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-300">
                          <Icon name="user" className="h-4 w-4" />
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {reporting && (
        <BugFormModal bug={null} defaultProjectId={projectId || undefined} onClose={() => setReporting(false)} onSaved={(bug) => onOpen(bug.id)} />
      )}
    </div>
  )
}
