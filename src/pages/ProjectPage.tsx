import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { api } from '../api'
import { errorMessage } from '../api/ApiError'
import BoardView from '../components/board/BoardView'
import ListView from '../components/board/ListView'
import ProjectFormModal from '../components/board/ProjectFormModal'
import WorkItemModal from '../components/board/WorkItemModal'
import Button from '../components/ui/Button'
import { useWorkspace } from '../context/workspaceContext'
import { onRealtime } from '../realtime/socket'
import type { Priority, WorkItem } from '../types'
import { cn, completion, priorityLabels } from '../utils/format'

type View = 'board' | 'list'

// What the task form needs to know when it opens.
interface Editor {
  key: number
  item: WorkItem | null
}

// Reads the project id from the address. The `key` makes React start a fresh
// board (new filters, new loading state) whenever you switch to another project.
export default function ProjectPage() {
  const { projectId = '' } = useParams()
  return <ProjectBoard key={projectId} projectId={projectId} />
}

function ProjectBoard({ projectId }: { projectId: string }) {
  const navigate = useNavigate()
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

  // Bumped after every save, so the effect below loads the items again.
  const [version, setVersion] = useState(0)

  useEffect(() => {
    // Ignore answers that arrive after you have left the page.
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
    // Reload when a teammate changes something (only active with a real backend).
    const unsubscribe = onRealtime('workItems:changed', load)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [projectId, version])

  // The project was deleted or the link is wrong: go back to the dashboard.
  if (!project) return <Navigate to="/app" replace />

  // Move a card: update the screen immediately, then save. Undo if saving fails.
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
  const filterClass = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-slate-900">{project.name}</h1>
          {project.description && <p className="mt-1 text-slate-600">{project.description}</p>}
          <p className="mt-2 text-sm text-slate-500">
            {progress.done} of {progress.total} done · {progress.percent}%
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => setEditingProject(true)}>
            Edit
          </Button>
          <Button variant="dangerGhost" onClick={handleDeleteProject}>
            Delete
          </Button>
          <Button onClick={() => openEditor(null)}>+ New {terminology.task.toLowerCase()}</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-slate-300 bg-white p-1">
          {(['board', 'list'] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn('rounded-md px-3 py-1 text-sm capitalize', view === v ? 'bg-slate-900 text-white' : 'text-slate-600')}
            >
              {v}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className={cn(filterClass, 'w-48')}
        />
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as Priority | '')} className={filterClass}>
          <option value="">All priorities</option>
          {(Object.keys(priorityLabels) as Priority[]).map((p) => (
            <option key={p} value={p}>
              {priorityLabels[p]}
            </option>
          ))}
        </select>
        <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} className={filterClass}>
          <option value="">Everyone</option>
          <option value="none">Unassigned</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.fullName}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : view === 'board' ? (
        <BoardView statuses={statuses} items={visibleItems} members={members} onMove={handleMove} onOpen={openEditor} />
      ) : (
        <ListView items={visibleItems} statuses={statuses} members={members} fields={fields} onOpen={openEditor} />
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

      {editingProject && <ProjectFormModal project={project} onClose={() => setEditingProject(false)} onSaved={() => undefined} />}
    </div>
  )
}
