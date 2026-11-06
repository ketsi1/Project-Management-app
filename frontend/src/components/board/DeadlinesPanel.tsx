import { useState } from 'react'
import { useAuth } from '../../context/authContext'
import { useWorkspace } from '../../context/workspaceContext'
import type { WorkItem } from '../../types'
import { pressable } from '../../utils/a11y'
import { categoryOf, cn, formatDate, todayIso } from '../../utils/format'
import WorkItemModal from '../board/WorkItemModal'
import Avatar from '../ui/Avatar'
import { EmptyState, PriorityBadge, StatCard, StatusPill } from '../ui/Display'
import Icon, { type IconName } from '../ui/Icon'

type BucketId = 'overdue' | 'today' | 'week' | 'later' | 'none'

const buckets: ReadonlyArray<{ id: BucketId; label: string; icon: IconName; tone: 'rose' | 'amber' | 'sky' | 'slate' | 'violet' }> = [
  { id: 'overdue', label: 'Overdue', icon: 'alert', tone: 'rose' },
  { id: 'today', label: 'Due today', icon: 'clock', tone: 'amber' },
  { id: 'week', label: 'Next 7 days', icon: 'calendar', tone: 'sky' },
  { id: 'later', label: 'Later', icon: 'trendingUp', tone: 'violet' },
  { id: 'none', label: 'No due date', icon: 'inbox', tone: 'slate' },
]

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function bucketOf(item: WorkItem, today: string, weekEnd: string): BucketId {
  if (!item.dueDate) return 'none'
  if (item.dueDate < today) return 'overdue'
  if (item.dueDate === today) return 'today'
  if (item.dueDate <= weekEnd) return 'week'
  return 'later'
}

// Open (not done, not cancelled) tasks sorted by when they are due. Shown on the Tasks page's
// Deadlines filter. `items` is already scoped: everyone's for managers, your own otherwise.
export default function DeadlinesPanel({ items, onChanged }: { items: WorkItem[]; onChanged: () => void }) {
  const { isManager } = useAuth()
  const { workspace, projects } = useWorkspace()
  const { statuses, members, terminology } = workspace
  const [editing, setEditing] = useState<WorkItem | null>(null)

  const today = todayIso()
  const weekEnd = addDays(today, 7)
  const open = items
    .filter((item) => {
      const category = categoryOf(item, statuses)
      return category !== 'done' && category !== 'cancelled'
    })
    .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'))

  const grouped = Object.fromEntries(buckets.map((b) => [b.id, [] as WorkItem[]])) as Record<BucketId, WorkItem[]>
  for (const item of open) grouped[bucketOf(item, today, weekEnd)].push(item)

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">
        {isManager ? 'Open work across the whole team, by due date.' : 'Your open work, by due date.'}
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {buckets.map((b) => (
          <StatCard
            key={b.id}
            label={b.label}
            value={grouped[b.id].length}
            icon={b.icon}
            tone={b.tone}
            onClick={() => document.getElementById(`bucket-${b.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          />
        ))}
      </div>

      {open.length === 0 ? (
        <div className="surface">
          <EmptyState icon="checkCircle" title="No open deadlines" description={`Every ${terminology.task.toLowerCase()} is done. Nice work.`} />
        </div>
      ) : (
        buckets
          .filter((b) => grouped[b.id].length > 0)
          .map((b) => (
            <section key={b.id} id={`bucket-${b.id}`} className="scroll-mt-20 space-y-2.5">
              <h2 className={cn('flex items-center gap-2 text-sm font-semibold', b.id === 'overdue' ? 'text-rose-700' : 'text-slate-800')}>
                <Icon name={b.icon} className="h-4 w-4" />
                {b.label}
                <span className="rounded-full bg-slate-100 px-2 text-xs text-slate-600 tabular-nums">{grouped[b.id].length}</span>
              </h2>
              <ul className="surface divide-y divide-slate-100 overflow-hidden">
                {grouped[b.id].map((item) => {
                  const project = projects.find((p) => p.id === item.projectId)
                  const assignee = members.find((m) => m.id === item.assigneeId)
                  return (
                    <li
                      key={item.id}
                      {...pressable(() => setEditing(item), `Open ${item.title}`)}
                      className="group flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-indigo-50/40"
                    >
                      <div className="min-w-0 flex-1 basis-60">
                        <p className="truncate text-sm font-medium text-slate-900 group-hover:text-indigo-700">{item.title}</p>
                        <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-slate-500">
                          <Icon name="folder" className="h-3.5 w-3.5 shrink-0" />
                          {project?.name ?? '—'}
                        </p>
                      </div>
                      <StatusPill status={statuses.find((s) => s.id === item.statusId)} />
                      <PriorityBadge priority={item.priority} />
                      {isManager && (
                        <span className="flex w-36 min-w-0 items-center gap-1.5 text-xs text-slate-600">
                          {assignee ? (
                            <>
                              <Avatar name={assignee.fullName} size="sm" />
                              <span className="truncate">{assignee.fullName}</span>
                            </>
                          ) : (
                            <span className="text-slate-400">Unassigned</span>
                          )}
                        </span>
                      )}
                      <span
                        className={cn(
                          'inline-flex w-28 items-center justify-end gap-1 text-xs whitespace-nowrap',
                          b.id === 'overdue' ? 'font-semibold text-rose-600' : 'text-slate-500',
                        )}
                      >
                        <Icon name="calendar" className="h-3.5 w-3.5" />
                        {formatDate(item.dueDate)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))
      )}

      {editing && (
        <WorkItemModal
          key={editing.id}
          projectId={editing.projectId}
          item={editing}
          defaultStatusId={statuses[0]?.id ?? ''}
          onClose={() => setEditing(null)}
          onSaved={onChanged}
        />
      )}
    </div>
  )
}
