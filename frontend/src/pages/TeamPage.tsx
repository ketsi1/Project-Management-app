import { Link } from 'react-router'
import Avatar from '../components/ui/Avatar'
import { Alert, EmptyState, LoadingState, PriorityBadge, ProgressBar } from '../components/ui/Display'
import Icon from '../components/ui/Icon'
import { useAuth } from '../context/authContext'
import { useWorkspace } from '../context/workspaceContext'
import { useWorkItems } from '../hooks/useWorkItems'
import type { Priority, Role } from '../types'
import { categoryOf, cn, completion, formatDate, isOverdue } from '../utils/format'

const roleLabels: Record<Role, string> = { owner: 'Manager', admin: 'Manager', member: 'Employee' }
const priorityRank: Record<Priority, number> = { urgent: 4, high: 3, medium: 2, low: 1 }

// Manager-only: who is working on what, and who is overloaded or falling behind.
export default function TeamPage() {
  const { session } = useAuth()
  const { workspace, projects } = useWorkspace()
  const { statuses, members, terminology } = workspace
  const { allItems, loading, error } = useWorkItems()

  if (loading) return <LoadingState label="Loading team…" />

  const unassignedOpen = allItems.filter((i) => !i.assigneeId && !['done', 'cancelled'].includes(categoryOf(i, statuses) ?? '')).length

  const rows = members.map((member) => {
    const mine = allItems.filter((i) => i.assigneeId === member.id)
    const open = mine.filter((i) => !['done', 'cancelled'].includes(categoryOf(i, statuses) ?? ''))
    const active = open.filter((i) => categoryOf(i, statuses) === 'active')
    const overdue = open.filter((i) => isOverdue(i, statuses))
    const progress = completion(mine, statuses)
    const next = [...open].sort(
      (a, b) =>
        Number(isOverdue(b, statuses)) - Number(isOverdue(a, statuses)) ||
        priorityRank[b.priority] - priorityRank[a.priority] ||
        (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'),
    )
    const projectCount = new Set(mine.map((i) => i.projectId)).size
    return { member, mine, open, active, overdue, progress, next, projectCount }
  })

  const maxOpen = Math.max(1, ...rows.map((r) => r.open.length))

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Team</h1>
          <p className="mt-1 text-sm text-slate-500">Workload, progress and overdue work for each person.</p>
        </div>
        {unassignedOpen > 0 && (
          <Link
            to="/app/tasks?assignee=none"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 ring-1 ring-amber-200 ring-inset hover:bg-amber-100"
          >
            <Icon name="alert" className="h-4 w-4" />
            {unassignedOpen} open {terminology.tasks.toLowerCase()} unassigned
          </Link>
        )}
      </div>

      {error && <Alert>{error}</Alert>}

      {rows.length === 0 ? (
        <div className="surface">
          <EmptyState icon="users" title="No team members yet" description="Invite people in Settings → Members." />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map(({ member, mine, open, active, overdue, progress, next, projectCount }) => (
            <article key={member.id} className="surface flex flex-col p-5">
              <header className="flex items-center gap-3">
                <Avatar name={member.fullName} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {member.fullName}
                    {member.id === session?.user.id && (
                      <span className="ml-2 rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-600">You</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {roleLabels[member.role]} · {member.email}
                  </p>
                </div>
                {overdue.length > 0 && (
                  <span className="shrink-0 rounded-md bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200 ring-inset">
                    {overdue.length} overdue
                  </span>
                )}
              </header>

              <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
                {[
                  { label: 'Open', value: open.length },
                  { label: 'Active', value: active.length },
                  { label: 'Done', value: progress.done },
                  { label: terminology.projects, value: projectCount },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-lg bg-slate-50 px-2 py-2">
                    <dd className="text-lg font-bold text-slate-900 tabular-nums">{stat.value}</dd>
                    <dt className="truncate text-[11px] font-medium text-slate-500">{stat.label}</dt>
                  </div>
                ))}
              </dl>

              <div className="mt-4 space-y-2 text-xs text-slate-500">
                <div>
                  <div className="mb-1 flex justify-between">
                    <span>Workload</span>
                    <span className="tabular-nums">{open.length} open</span>
                  </div>
                  <ProgressBar percent={(open.length / maxOpen) * 100} tone={open.length === maxOpen && open.length > 2 ? 'amber' : 'indigo'} />
                </div>
                <div>
                  <div className="mb-1 flex justify-between">
                    <span>Completion</span>
                    <span className="tabular-nums">{progress.percent}%</span>
                  </div>
                  <ProgressBar percent={progress.percent} tone="emerald" />
                </div>
              </div>

              <div className="mt-4 flex-1">
                <p className="eyebrow mb-2">Up next</p>
                {next.length === 0 ? (
                  <p className="text-sm text-slate-400">Nothing open.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {next.slice(0, 3).map((item) => (
                      <li key={item.id} className="flex items-center gap-2 text-sm">
                        <PriorityBadge priority={item.priority} />
                        <span className="min-w-0 flex-1 truncate text-slate-700">{item.title}</span>
                        <span className="hidden max-w-[8rem] shrink truncate text-xs text-slate-400 xl:inline">
                          {projects.find((p) => p.id === item.projectId)?.name}
                        </span>
                        <span className={cn('shrink-0 text-xs', isOverdue(item, statuses) ? 'font-semibold text-rose-600' : 'text-slate-500')}>
                          {formatDate(item.dueDate)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <Link
                to={`/app/tasks?assignee=${member.id}`}
                className="mt-4 inline-flex items-center gap-1 self-start text-sm font-semibold text-indigo-600 hover:text-indigo-700"
              >
                View all {mine.length} {terminology.tasks.toLowerCase()}
                <Icon name="arrowRight" className="h-3.5 w-3.5" />
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
