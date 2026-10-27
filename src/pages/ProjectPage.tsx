import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { api } from '../api'
import { errorMessage } from '../api/ApiError'
import BoardView from '../components/board/BoardView'
import ListView from '../components/board/ListView'
import ProjectFormModal from '../components/board/ProjectFormModal'
import WorkItemModal from '../components/board/WorkItemModal'
import Button from '../components/ui/Button'
import { Alert, LoadingState, ProgressBar } from '../components/ui/Display'
import Icon from '../components/ui/Icon'
import { useAuth } from '../context/authContext'
import { useWorkspace } from '../context/workspaceContext'
import { onRealtime } from '../realtime/socket'
import type { Priority, WorkItem } from '../types'
import { cn, completion, priorityLabels } from '../utils/format'

type View = 'board' | 'list'

interface Editor {
  key: number
  item: WorkItem | null
}

export default function ProjectPage() {
  const { projectId = '' } = useParams()
  return <ProjectBoard key={projectId} projectId={projectId} />
}

function ProjectBoard({ projectId }: { projectId: string }) {
  const navigate = useNavigate()
  const { session, isManager } = useAuth()
  const { workspace, projects, reloadProjects } = useWorkspace()
  const { statuses, members, fields, terminology } = workspace
  const project = projects.find((p) => p.id === projectId)

  const [items, setItems] = useState<WorkItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState<View>('board')
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<Priority | ''>('')
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [editor, setEditor] = useState<Editor | null>(null)
  const [editingProject, setEditingProject] = useState(false)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    function load() {
      api
        .listWorkItems(projectId)
        .then((list) => {
          if (cancelled) return
          setItems(list)
          setError('')
        })
        .catch((e) => {
          if (!cancelled) setError(errorMessage(e))
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }
    load()
    const unsubscribe = onRealtime('workItems:changed', load)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [projectId, version])

  if (!project) return <Navigate to="/app" replace />

  async function handleMove(itemId: string, statusId: string) {
    const previous = items
    setItems((current) => current.map((i) => (i.id === itemId ? { ...i, statusId } : i)))
    try {
      await api.updateWorkItem(itemId, { statusId })
    } catch (e) {
      setItems(previous)
      setError(errorMessage(e))
    }
  }

  async function handleDeleteProject() {
    if (!project) return
    if (!window.confirm(`Delete "${project.name}" and everything in it?`)) return
    try {
      await api.deleteProject(project.id)
      await reloadProjects()
      navigate('/app')
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  function openEditor(item: WorkItem | null) {
    setEditor({ key: Date.now(), item })
  }

  const visibleItems = items.filter((item) => {
    if (search && !item.title.toLowerCase().includes(search.toLowerCase())) return false
    if (priorityFilter && item.priority !== priorityFilter) return false
    if (assigneeFilter === 'none' && item.assigneeId) return false
    if (assigneeFilter && assigneeFilter !== 'none' && item.assigneeId !== assigneeFilter) return false
    return true
  })

  const progress = completion(items, statuses)
  const myTasksOnly = assigneeFilter === session?.user.id
  const filtersActive = Boolean(search || priorityFilter || assigneeFilter)

  return (
    <div className="space-y-5 pb-10 sm:space-y-6">
      {/* Project header */}
      <header className="surface p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-lg font-bold uppercase text-indigo-600 ring-1 ring-inset ring-indigo-100">
              {project.name.charAt(0)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="eyebrow">{terminology.project}</p>
              <h1 className="mt-0.5 text-xl font-bold text-slate-900 sm:text-2xl">{project.name}</h1>
              {project.description && <p className="mt-1 max-w-3xl text-sm text-slate-500">{project.description}</p>}

              <div className="mt-3 flex max-w-sm items-center gap-3">
                <ProgressBar percent={progress.percent} tone="emerald" className="h-2" />
                <span className="shrink-0 text-xs font-medium tabular-nums text-slate-500">
                  {progress.done}/{progress.total} done · {progress.percent}%
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
            {isManager && (
              <>
                <Button variant="secondary" onClick={() => setEditingProject(true)}>
                  <Icon name="pencil" className="h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button variant="dangerGhost" onClick={handleDeleteProject}>
                  <Icon name="trash" className="h-3.5 w-3.5" />
                  Delete
                </Button>
              </>
            )}
            <Button onClick={() => openEditor(null)} className="max-sm:flex-1">
              <Icon name="plus" className="h-4 w-4" />
              New {terminology.task}
            </Button>
          </div>
        </div>
      </header>

      {/* Toolbar: view toggle + filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <div
            className="relative inline-grid grid-cols-2 rounded-lg border border-slate-200 bg-white p-1 shadow-card"
            role="tablist"
            aria-label="View"
          >
            <span
              aria-hidden="true"
              className={cn(
                'absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-md bg-indigo-600 shadow-sm transition-transform duration-300 ease-out-expo',
                view === 'list' && 'translate-x-full',
              )}
            />
            {(['board', 'list'] as View[]).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={cn(
                  'relative z-10 flex items-center justify-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold capitalize transition-colors duration-200',
                  view === v ? 'text-white' : 'text-slate-500 hover:text-slate-900',
                )}
              >
                <Icon name={v === 'board' ? 'board' : 'list'} className="h-3.5 w-3.5" />
                {v}
              </button>
            ))}
          </div>

          <button
            type="button"
            aria-pressed={myTasksOnly}
            onClick={() =>
              assigneeFilter === session?.user.id
                ? setAssigneeFilter('')
                : setAssigneeFilter(session?.user.id || '')
            }
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold shadow-card transition-colors',
              myTasksOnly
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
            )}
          >
            <Icon name="star" className={cn('h-3.5 w-3.5', myTasksOnly && 'fill-indigo-500 text-indigo-500')} />
            My tasks
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <div className="relative col-span-2 sm:col-span-1">
            <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks…"
              aria-label="Search tasks"
              className="input-sm w-full pl-9 sm:w-56"
            />
          </div>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as Priority | '')}
            aria-label="Priority"
            className="input-sm min-w-0 font-medium text-slate-700"
          >
            <option value="">All priorities</option>
            {(Object.keys(priorityLabels) as Priority[]).map((p) => (
              <option key={p} value={p}>
                {priorityLabels[p]}
              </option>
            ))}
          </select>

          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            aria-label="Assignee"
            className="input-sm min-w-0 font-medium text-slate-700"
          >
            <option value="">Everyone</option>
            <option value="none">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.fullName} {m.id === session?.user.id ? '(You)' : ''}
              </option>
            ))}
          </select>

          {filtersActive && (
            <Button
              variant="ghost"
              size="sm"
              className="col-span-2 h-9 sm:col-span-1"
              onClick={() => {
                setSearch('')
                setPriorityFilter('')
                setAssigneeFilter('')
              }}
            >
              <Icon name="x" className="h-3.5 w-3.5" />
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      {/* Board / list */}
      {loading ? (
        <div className="surface">
          <LoadingState label="Loading tasks…" />
        </div>
      ) : (
        <div key={view} className="animate-fade-in">
          {view === 'board' ? (
            <BoardView statuses={statuses} items={visibleItems} members={members} onMove={handleMove} onOpen={openEditor} />
          ) : (
            <ListView items={visibleItems} statuses={statuses} members={members} fields={fields} onOpen={openEditor} />
          )}
        </div>
      )}

      {editor && (
        <WorkItemModal
          key={editor.key}
          projectId={project.id}
          item={editor.item}
          defaultStatusId={statuses[0]?.id ?? ''}
          onClose={() => setEditor(null)}
          onSaved={() => setVersion((v) => v + 1)}
        />
      )}

      {editingProject && (
        <ProjectFormModal project={project} onClose={() => setEditingProject(false)} onSaved={() => undefined} />
      )}
    </div>
  )
}
