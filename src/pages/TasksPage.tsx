import { useState } from 'react'
import { useSearchParams } from 'react-router'
import ListView from '../components/board/ListView'
import WorkItemModal from '../components/board/WorkItemModal'
import Button from '../components/ui/Button'
import { Alert, EmptyState, LoadingState } from '../components/ui/Display'
import Icon from '../components/ui/Icon'
import { useAuth } from '../context/authContext'
import { useWorkspace } from '../context/workspaceContext'
import { useWorkItems } from '../hooks/useWorkItems'
import type { Priority, WorkItem } from '../types'
import { isOverdue, priorityLabels } from '../utils/format'

// Every task in one place, grouped under its project.
// Managers see the whole organization; employees see only their own tasks.
export default function TasksPage() {
  const { isManager } = useAuth()
  const { workspace, projects } = useWorkspace()
  const { statuses, members, fields, terminology } = workspace
  const { items, loading, error, reload } = useWorkItems()
  const [params, setParams] = useSearchParams()

  const [search, setSearch] = useState('')
  const [projectId, setProjectId] = useState('')
  const [statusId, setStatusId] = useState('')
  const [priority, setPriority] = useState('')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const assigneeId = params.get('assignee') ?? '' // set from the Team page
  const [editing, setEditing] = useState<WorkItem | null>(null)
  const [creating, setCreating] = useState(false)

  function setAssignee(value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set('assignee', value)
    else next.delete('assignee')
    setParams(next, { replace: true })
  }

  if (loading) return <LoadingState label={`Loading ${terminology.tasks.toLowerCase()}…`} />

  const filtered = items.filter((item) => {
    if (search && !item.title.toLowerCase().includes(search.toLowerCase())) return false
    if (projectId && item.projectId !== projectId) return false
    if (statusId && item.statusId !== statusId) return false
    if (priority && item.priority !== priority) return false
    if (isManager && assigneeId === 'none' && item.assigneeId) return false
    if (isManager && assigneeId && assigneeId !== 'none' && item.assigneeId !== assigneeId) return false
    if (overdueOnly && !isOverdue(item, statuses)) return false
    return true
  })

  const groups = projects
    .map((project) => ({ project, items: filtered.filter((i) => i.projectId === project.id) }))
    .filter((g) => g.items.length > 0)

  const hasFilters = Boolean(search || projectId || statusId || priority || assigneeId || overdueOnly)
  const select = 'input-sm font-medium text-slate-700'

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{isManager ? `All ${terminology.tasks.toLowerCase()}` : `My ${terminology.tasks.toLowerCase()}`}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {isManager
              ? `Every ${terminology.task.toLowerCase()} across the organization, grouped by ${terminology.project.toLowerCase()}.`
              : `Everything assigned to you, grouped by ${terminology.project.toLowerCase()}.`}
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Icon name="plus" className="h-4 w-4" />
          New {terminology.task.toLowerCase()}
        </Button>
      </div>

      {error && <Alert>{error}</Alert>}

      {/* Filters */}
      <div className="surface flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[12rem] flex-1">
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${terminology.tasks.toLowerCase()}…`}
            aria-label="Search"
            className="input-sm w-full pl-9"
          />
        </div>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={select} aria-label={terminology.project}>
          <option value="">All {terminology.projects.toLowerCase()}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select value={statusId} onChange={(e) => setStatusId(e.target.value)} className={select} aria-label="Status">
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className={select} aria-label="Priority">
          <option value="">All priorities</option>
          {(Object.keys(priorityLabels) as Priority[]).map((p) => (
            <option key={p} value={p}>
              {priorityLabels[p]}
            </option>
          ))}
        </select>
        {isManager && (
          <select value={assigneeId} onChange={(e) => setAssignee(e.target.value)} className={select} aria-label="Assignee">
            <option value="">Everyone</option>
            <option value="none">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.fullName}
              </option>
            ))}
          </select>
        )}
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-700">
          <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} className="accent-rose-600" />
          Overdue only
        </label>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setSearch('')
              setProjectId('')
              setStatusId('')
              setPriority('')
              setOverdueOnly(false)
              setAssignee('')
            }}
            className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
          >
            Clear
          </button>
        )}
      </div>

      <p className="text-sm text-slate-500">
        Showing <span className="font-semibold text-slate-800">{filtered.length}</span> of {items.length} {terminology.tasks.toLowerCase()}
      </p>

      {groups.length === 0 ? (
        <div className="surface">
          <EmptyState
            icon="inbox"
            title={hasFilters ? 'Nothing matches these filters' : `No ${terminology.tasks.toLowerCase()} yet`}
            description={hasFilters ? 'Try clearing a filter.' : undefined}
          />
        </div>
      ) : (
        groups.map(({ project, items: projectItems }) => (
          <section key={project.id} className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-50 text-[11px] font-bold text-indigo-600 uppercase">
                {project.name.charAt(0)}
              </span>
              {project.name}
              <span className="rounded-full bg-slate-100 px-2 text-xs text-slate-600 tabular-nums">{projectItems.length}</span>
            </h2>
            <ListView items={projectItems} statuses={statuses} members={members} fields={fields} onOpen={setEditing} />
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
          onSaved={reload}
        />
      )}
      {creating && (
        <WorkItemModal
          key="tasks-page-create"
          projectId={projectId || projects[0]?.id || ''}
          item={null}
          defaultStatusId={statuses[0]?.id ?? ''}
          onClose={() => setCreating(false)}
          onSaved={reload}
        />
      )}
    </div>
  )
}
