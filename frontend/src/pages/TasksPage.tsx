import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router'
import ListView from '../components/board/ListView'
import WorkItemModal from '../components/board/WorkItemModal'
import BugDetail from '../components/bugs/BugDetail'
import BugsPanel from '../components/bugs/BugsPanel'
import DeadlinesPanel from '../components/board/DeadlinesPanel'
import Button from '../components/ui/Button'
import { Alert, EmptyState, LoadingState } from '../components/ui/Display'
import Drawer from '../components/ui/Drawer'
import Icon, { type IconName } from '../components/ui/Icon'
import { useAuth } from '../context/authContext'
import { useWorkspace } from '../context/workspaceContext'
import { useBugs } from '../hooks/useBugs'
import { useWorkItems } from '../hooks/useWorkItems'
import type { Priority, WorkItem } from '../types'
import { isFinished } from '../utils/bugs'
import { cn, isOverdue, priorityLabels } from '../utils/format'

type View = 'tasks' | 'deadlines' | 'bugs'
const VIEWS: View[] = ['tasks', 'deadlines', 'bugs']

// The Tasks page. A filter bar switches between the task list, deadlines and bugs.
// The filter lives in the address (?view=bugs), so links and refreshes keep it;
// ?bug=<id> opens that bug in a drawer. Managers see the whole organization; employees their own work.
export default function TasksPage() {
  const { isManager, can } = useAuth()
  const { workspace } = useWorkspace()
  const { terminology } = workspace
  const { items, loading, error, reload } = useWorkItems()
  const bugs = useBugs()
  const [params, setParams] = useSearchParams()
  const [creating, setCreating] = useState(false)

  const requested = params.get('view') as View | null
  const view: View = requested && VIEWS.includes(requested) ? requested : 'tasks'
  const openBugId = params.get('bug')

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    setParams(next, { replace: true })
  }

  const closeBug = useCallback(() => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.delete('bug')
        return next
      },
      { replace: true },
    )
  }, [setParams])

  if (loading) return <LoadingState label={`Loading ${terminology.tasks.toLowerCase()}…`} />

  const tasksWord = terminology.tasks.toLowerCase()
  const overdue = items.filter((item) => isOverdue(item, workspace.statuses)).length
  const activeBugs = bugs.bugs.filter((b) => !isFinished(b.status)).length

  const filters: Array<{ id: View; label: string; icon: IconName; count?: number; alert?: boolean; hint: string }> = [
    { id: 'tasks', label: terminology.tasks, icon: 'list', count: items.length, hint: isManager ? `Every ${terminology.task.toLowerCase()}` : `Your ${tasksWord}` },
    { id: 'deadlines', label: 'Deadlines', icon: 'calendar', count: overdue, alert: overdue > 0, hint: overdue > 0 ? `${overdue} overdue` : 'Nothing overdue' },
    { id: 'bugs', label: 'Bugs', icon: 'bug', count: activeBugs, hint: `${activeBugs} active` },
  ]

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{isManager ? `All ${tasksWord}` : `My ${tasksWord}`}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {view === 'tasks' &&
              (isManager
                ? `Every ${terminology.task.toLowerCase()} across the organization, grouped by ${terminology.project.toLowerCase()}.`
                : `Everything assigned to you, grouped by ${terminology.project.toLowerCase()}.`)}
            {view === 'deadlines' && (isManager ? 'Open work across the whole team, by due date.' : 'Your open work, by due date.')}
            {view === 'bugs' && (can('bugs.view_all') ? 'Every reported bug across the organization.' : 'Bugs you reported, bugs assigned to you, and bugs in your projects.')}
          </p>
        </div>
        {view === 'tasks' && can('tasks.create') && (
          <Button onClick={() => setCreating(true)}>
            <Icon name="plus" className="h-4 w-4" />
            New {terminology.task.toLowerCase()}
          </Button>
        )}
      </div>

      {/* Filter bar */}
      <div role="tablist" aria-label="Show" className="grid grid-cols-3 gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-card sm:inline-grid sm:w-auto">
        {filters.map((f) => {
          const selected = view === f.id
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={selected}
              title={f.hint}
              onClick={() => update({ view: f.id === 'tasks' ? null : f.id, bug: null, project: f.id === 'bugs' ? params.get('project') : null })}
              className={cn(
                'flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors sm:px-4',
                selected ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )}
            >
              <Icon name={f.icon} className="h-4 w-4 shrink-0" />
              <span className="truncate">{f.label}</span>
              {!!f.count && (
                <span
                  className={cn(
                    'rounded-full px-1.5 text-[11px] font-bold tabular-nums',
                    selected ? 'bg-white/20 text-white' : f.alert ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600',
                  )}
                >
                  {f.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {error && <Alert>{error}</Alert>}

      <div key={view} className="animate-fade-in">
        {view === 'tasks' && <TaskList items={items} reload={reload} creating={creating} onCreatingChange={setCreating} />}
        {view === 'deadlines' && <DeadlinesPanel items={items} onChanged={reload} />}
        {view === 'bugs' && <BugsPanel bugs={bugs.bugs} loading={bugs.loading} error={bugs.error} onOpen={(id) => update({ view: 'bugs', bug: id })} />}
      </div>

      {openBugId && (
        <Drawer title="Bug details" onClose={closeBug}>
          <BugDetail key={openBugId} bugId={openBugId} onClose={closeBug} />
        </Drawer>
      )}
    </div>
  )
}

interface TaskListProps {
  items: WorkItem[]
  reload: () => void
  creating: boolean
  onCreatingChange: (creating: boolean) => void
}

// Every task in one place, grouped under its project, with filters.
function TaskList({ items, reload, creating, onCreatingChange }: TaskListProps) {
  const { isManager } = useAuth()
  const { workspace, projects } = useWorkspace()
  const { statuses, members, fields, terminology } = workspace
  const [params, setParams] = useSearchParams()

  const [search, setSearch] = useState('')
  const [projectId, setProjectId] = useState('')
  const [statusId, setStatusId] = useState('')
  const [priority, setPriority] = useState('')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const assigneeId = params.get('assignee') ?? '' // set from the Team page
  const [editing, setEditing] = useState<WorkItem | null>(null)

  function setAssignee(value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set('assignee', value)
    else next.delete('assignee')
    setParams(next, { replace: true })
  }

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
    <div className="space-y-6">
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
          onClose={() => onCreatingChange(false)}
          onSaved={reload}
        />
      )}
    </div>
  )
}
