import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { api } from '../../api'
import { errorMessage } from '../../api/ApiError'
import { useAuth } from '../../context/authContext'
import { useWorkspace } from '../../context/workspaceContext'
import { onRealtime } from '../../realtime/socket'
import type { BugChanges, BugDetail as BugDetailData, BugResolution, BugSeverity, BugStatus, Priority, WorkItem } from '../../types'
import { isFinished, resolutionLabels, severityLabels, severityOrder, statusLabels, statusOrder, timeAgo } from '../../utils/bugs'
import { cn, priorityLabels } from '../../utils/format'
import Avatar from '../ui/Avatar'
import Button from '../ui/Button'
import { Alert, EmptyState, LoadingState, PriorityBadge } from '../ui/Display'
import Icon from '../ui/Icon'
import { BugStatusPill, SeverityBadge } from './BugBadges'
import BugFormModal from './BugFormModal'

// One bug: what is wrong, how to reproduce it, who is on it, and its discussion and history.
// Shown in a drawer on the Tasks page's Bugs filter.
export default function BugDetail({ bugId, onClose }: { bugId: string; onClose: () => void }) {
  const { session, can } = useAuth()
  const { workspace, projects } = useWorkspace()
  const me = session?.user.id

  const [bug, setBug] = useState<BugDetailData | null>(null)
  const [linkedTask, setLinkedTask] = useState<WorkItem | null>(null)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [comment, setComment] = useState('')
  const [posting, setPosting] = useState(false)
  const [resolution, setResolution] = useState<BugResolution>('fixed')

  const load = useCallback(async () => {
    try {
      const loaded = await api.getBug(bugId)
      setBug(loaded)
      setLoadError('')
      if (loaded.workItemId) {
        const items = await api.listWorkItems(loaded.projectId).catch(() => [])
        setLinkedTask(items.find((i) => i.id === loaded.workItemId) ?? null)
      } else setLinkedTask(null)
    } catch (e) {
      setLoadError(errorMessage(e))
    }
  }, [bugId])

  useEffect(() => {
    void load()
    return onRealtime('bugs:changed', () => void load())
  }, [load])

  if (loadError) {
    return (
      <div className="surface">
        <EmptyState icon="bug" title="This bug is not available" description={loadError} action={<Button onClick={onClose}>Close</Button>} />
      </div>
    )
  }
  if (!bug) return <LoadingState label="Loading bug…" />

  // What this person may do with this bug (the backend checks the same rules).
  const triage = can('bugs.manage')
  const isReporter = bug.reporterId === me
  const isAssignee = bug.assigneeId === me
  const canEditDetails = triage || isReporter
  const canChangeStatus = triage || isReporter || isAssignee
  const canDelete = triage || (isReporter && bug.status === 'open')

  const memberName = (id: string | null) => (id ? (workspace.members.find((m) => m.id === id)?.fullName ?? 'Former member') : null)
  const project = projects.find((p) => p.id === bug.projectId)

  async function change(changes: BugChanges) {
    setBusy(true)
    setError('')
    try {
      await api.updateBug(bugId, changes)
      await load()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete ${bug!.key}? Its comments and history are deleted too.`)) return
    try {
      await api.deleteBug(bugId)
      onClose()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  async function handleComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!comment.trim()) return
    setPosting(true)
    setError('')
    try {
      await api.addBugComment(bugId, comment.trim())
      setComment('')
      await load()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setPosting(false)
    }
  }

  // The usual next step for the current status.
  const nextSteps: Array<{ label: string; icon: 'zap' | 'checkCircle' | 'check' | 'swap'; changes: BugChanges; primary?: boolean }> =
    bug.status === 'open'
      ? [
          { label: 'Start progress', icon: 'zap', changes: { status: 'in_progress' }, primary: true },
          { label: 'Resolve', icon: 'checkCircle', changes: { status: 'resolved', resolution } },
        ]
      : bug.status === 'in_progress'
        ? [{ label: 'Resolve', icon: 'checkCircle', changes: { status: 'resolved', resolution }, primary: true }]
        : bug.status === 'resolved'
          ? [
              { label: 'Close', icon: 'check', changes: { status: 'closed' }, primary: true },
              { label: 'Reopen', icon: 'swap', changes: { status: 'open' } },
            ]
          : [{ label: 'Reopen', icon: 'swap', changes: { status: 'open' } }]
  const offersResolution = canChangeStatus && nextSteps.some((s) => s.changes.status === 'resolved')

  const sections: Array<{ title: string; body: string }> = [
    { title: 'Steps to reproduce', body: bug.stepsToReproduce },
    { title: 'More details', body: bug.description },
  ].filter((s) => s.body.trim())

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <header className="surface p-4 sm:p-6">
        <div className="flex flex-col gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold text-slate-400">{bug.key}</span>
              <SeverityBadge severity={bug.severity} />
              <BugStatusPill status={bug.status} resolution={bug.resolution} />
            </div>
            <h1 className="mt-2 text-xl font-bold text-slate-900 sm:text-2xl">{bug.title}</h1>
            <p className="mt-1 text-sm text-slate-500">
              Reported by {memberName(bug.reporterId) ?? 'someone'} {timeAgo(bug.createdAt)} in {project?.name ?? 'a project'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canChangeStatus && (
              <>
                {offersResolution && (
                  <select
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value as BugResolution)}
                    className="input-sm font-medium text-slate-700"
                    aria-label="Resolution when resolving"
                  >
                    {(Object.keys(resolutionLabels) as BugResolution[]).map((r) => (
                      <option key={r} value={r}>
                        {resolutionLabels[r]}
                      </option>
                    ))}
                  </select>
                )}
                {nextSteps.map((step) => (
                  <Button key={step.label} variant={step.primary ? 'primary' : 'secondary'} disabled={busy} onClick={() => change(step.changes)}>
                    <Icon name={step.icon} className="h-4 w-4" />
                    {step.label}
                  </Button>
                ))}
              </>
            )}
            {canEditDetails && (
              <Button variant="ghost" onClick={() => setEditing(true)}>
                <Icon name="pencil" className="h-3.5 w-3.5" />
                Edit
              </Button>
            )}
            {canDelete && (
              <Button variant="dangerGhost" onClick={handleDelete}>
                <Icon name="trash" className="h-3.5 w-3.5" />
                Delete
              </Button>
            )}
          </div>
        </div>
      </header>

      {error && <Alert>{error}</Alert>}

      <div className="grid gap-5 lg:grid-cols-[1fr_17rem]">
        {/* Main column */}
        <div className="min-w-0 space-y-5">
          {(bug.expectedResult || bug.actualResult) && (
            <div className="grid gap-3 sm:grid-cols-2">
              <ResultCard tone="emerald" title="Expected" body={bug.expectedResult} />
              <ResultCard tone="rose" title="Actually happens" body={bug.actualResult} />
            </div>
          )}
          {sections.map((s) => (
            <section key={s.title} className="surface p-4 sm:p-5">
              <h2 className="eyebrow mb-2">{s.title}</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{s.body}</p>
            </section>
          ))}
          {sections.length === 0 && !bug.expectedResult && !bug.actualResult && (
            <p className="surface p-4 text-sm text-slate-500">No steps or details yet.{canEditDetails && ' Use Edit to add how to reproduce it.'}</p>
          )}

          {/* Discussion + history */}
          <section className="surface p-4 sm:p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Icon name="message" className="h-4 w-4 text-slate-400" />
              Activity
              <span className="rounded-full bg-slate-100 px-2 text-xs text-slate-500 tabular-nums">{bug.commentCount} comments</span>
            </h2>
            <ol className="space-y-4">
              {bug.comments.map((c) =>
                c.kind === 'event' ? (
                  <li key={c.id} className="flex items-center gap-2 pl-2 text-xs text-slate-500">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                    <span>
                      <span className="font-semibold text-slate-700">{c.authorName ?? 'Someone'}</span> {c.body}
                    </span>
                    <span className="ml-auto shrink-0 text-slate-400">{timeAgo(c.createdAt)}</span>
                  </li>
                ) : (
                  <li key={c.id} className="flex gap-3">
                    <Avatar name={c.authorName ?? '?'} />
                    <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5">
                      <p className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="font-semibold text-slate-800">{c.authorName ?? 'Former member'}</span>
                        <span className="text-slate-400">{timeAgo(c.createdAt)}</span>
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{c.body}</p>
                    </div>
                  </li>
                ),
              )}
            </ol>
            <form onSubmit={handleComment} className="mt-5 flex gap-3 border-t border-slate-100 pt-4">
              <Avatar name={session?.user.fullName ?? '?'} />
              <div className="min-w-0 flex-1 space-y-2">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) e.currentTarget.form?.requestSubmit()
                  }}
                  rows={3}
                  placeholder="Add a comment… (Ctrl+Enter to send)"
                  aria-label="Comment"
                  className="block w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-card outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-400 focus:ring-3 focus:ring-indigo-100"
                />
                <Button type="submit" size="sm" loading={posting} disabled={!comment.trim()}>
                  Comment
                </Button>
              </div>
            </form>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="surface h-fit divide-y divide-slate-100 lg:sticky lg:top-0">
          <Field label="Status">
            {canChangeStatus ? (
              <select
                value={bug.status}
                disabled={busy}
                onChange={(e) => change({ status: e.target.value as BugStatus })}
                className="input-sm w-full font-medium text-slate-700"
                aria-label="Status"
              >
                {statusOrder.map((s) => (
                  <option key={s} value={s}>
                    {statusLabels[s]}
                  </option>
                ))}
              </select>
            ) : (
              <BugStatusPill status={bug.status} />
            )}
          </Field>
          {isFinished(bug.status) && (
            <Field label="Resolution">
              {canChangeStatus ? (
                <select
                  value={bug.resolution ?? 'fixed'}
                  disabled={busy}
                  onChange={(e) => change({ resolution: e.target.value as BugResolution })}
                  className="input-sm w-full font-medium text-slate-700"
                  aria-label="Resolution"
                >
                  {(Object.keys(resolutionLabels) as BugResolution[]).map((r) => (
                    <option key={r} value={r}>
                      {resolutionLabels[r]}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-sm text-slate-700">{bug.resolution ? resolutionLabels[bug.resolution] : '—'}</span>
              )}
            </Field>
          )}
          <Field label="Assignee">
            {triage ? (
              <div className="space-y-1.5">
                <select
                  value={bug.assigneeId ?? ''}
                  disabled={busy}
                  onChange={(e) => change({ assigneeId: e.target.value || null })}
                  className="input-sm w-full font-medium text-slate-700"
                  aria-label="Assignee"
                >
                  <option value="">Unassigned</option>
                  {workspace.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName}
                    </option>
                  ))}
                </select>
                {!isAssignee && (
                  <button type="button" onClick={() => change({ assigneeId: me ?? null })} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                    Assign to me
                  </button>
                )}
              </div>
            ) : (
              <Person name={memberName(bug.assigneeId)} empty="Unassigned" />
            )}
          </Field>
          <Field label="Severity">
            {canEditDetails ? (
              <select
                value={bug.severity}
                disabled={busy}
                onChange={(e) => change({ severity: e.target.value as BugSeverity })}
                className="input-sm w-full font-medium text-slate-700"
                aria-label="Severity"
              >
                {severityOrder.map((s) => (
                  <option key={s} value={s}>
                    {severityLabels[s]}
                  </option>
                ))}
              </select>
            ) : (
              <SeverityBadge severity={bug.severity} />
            )}
          </Field>
          <Field label="Priority">
            {triage ? (
              <select
                value={bug.priority}
                disabled={busy}
                onChange={(e) => change({ priority: e.target.value as Priority })}
                className="input-sm w-full font-medium text-slate-700"
                aria-label="Priority"
              >
                {(Object.keys(priorityLabels) as Priority[]).map((p) => (
                  <option key={p} value={p}>
                    {priorityLabels[p]}
                  </option>
                ))}
              </select>
            ) : (
              <PriorityBadge priority={bug.priority} />
            )}
          </Field>
          <Field label={workspace.terminology.project}>
            {project ? (
              <Link to={`/app/projects/${project.id}`} className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
                {project.name}
              </Link>
            ) : (
              <span className="text-sm text-slate-500">—</span>
            )}
          </Field>
          {bug.workItemId && (
            <Field label={`Related ${workspace.terminology.task.toLowerCase()}`}>
              <span className="text-sm text-slate-700">{linkedTask?.title ?? 'A task you cannot see'}</span>
            </Field>
          )}
          {bug.environment && (
            <Field label="Environment">
              <span className="text-sm text-slate-700">{bug.environment}</span>
            </Field>
          )}
          <Field label="Reporter">
            <Person name={memberName(bug.reporterId)} empty="Former member" />
          </Field>
          <Field label="Dates">
            <dl className="space-y-1 text-xs">
              <DateRow label="Reported" iso={bug.createdAt} />
              <DateRow label="Updated" iso={bug.updatedAt} />
              {bug.resolvedAt && <DateRow label="Resolved" iso={bug.resolvedAt} />}
              {bug.closedAt && <DateRow label="Closed" iso={bug.closedAt} />}
            </dl>
          </Field>
        </aside>
      </div>

      {editing && <BugFormModal bug={bug} onClose={() => setEditing(false)} onSaved={() => void load()} />}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="px-4 py-3">
      <p className="eyebrow mb-1.5">{label}</p>
      {children}
    </div>
  )
}

function Person({ name, empty }: { name: string | null; empty: string }) {
  if (!name) return <span className="text-sm text-slate-400">{empty}</span>
  return (
    <span className="flex items-center gap-2 text-sm font-medium text-slate-800">
      <Avatar name={name} size="sm" />
      {name}
    </span>
  )
}

function DateRow({ label, iso }: { label: string; iso: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-700" title={new Date(iso).toLocaleString()}>
        {new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
      </dd>
    </div>
  )
}

function ResultCard({ tone, title, body }: { tone: 'emerald' | 'rose'; title: string; body: string }) {
  return (
    <section className={cn('rounded-xl border p-4', tone === 'emerald' ? 'border-emerald-200 bg-emerald-50/50' : 'border-rose-200 bg-rose-50/50')}>
      <h2 className={cn('mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider', tone === 'emerald' ? 'text-emerald-700' : 'text-rose-700')}>
        <Icon name={tone === 'emerald' ? 'checkCircle' : 'alert'} className="h-3.5 w-3.5" />
        {title}
      </h2>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{body || '—'}</p>
    </section>
  )
}
