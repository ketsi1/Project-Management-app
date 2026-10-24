import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { api } from '../api'
import { errorMessage } from '../api/ApiError'
import { useAuth } from '../context/authContext'
import { useWorkspace } from '../context/workspaceContext'
import { onRealtime } from '../realtime/socket'
import type { WorkItem } from '../types'
import { categoryOf, completion, formatDate, isOverdue, priorityLabels, priorityStyles, cn } from '../utils/format'

// Overview across all projects: totals, my open work and progress per project.
export default function DashboardPage() {
  const { session } = useAuth()
  const { workspace, projects } = useWorkspace()
  const { statuses, terminology } = workspace
  const [items, setItems] = useState<WorkItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    function load() {
      api
        .listWorkItems()
        .then(setItems)
        .catch((e) => setError(errorMessage(e)))
        .finally(() => setLoading(false))
    }
    load()
    // Refresh when a teammate changes something (only active with a real backend).
    return onRealtime('workItems:changed', load)
  }, [])

  if (loading) return <p className="text-slate-500">Loading…</p>
  if (error) return <p className="text-red-600">{error}</p>

  const active = items.filter((i) => categoryOf(i, statuses) === 'active').length
  const done = items.filter((i) => categoryOf(i, statuses) === 'done').length
  const overdue = items.filter((i) => isOverdue(i, statuses)).length

  const myOpenWork = items
    .filter((i) => i.assigneeId === session?.user.id)
    .filter((i) => {
      const category = categoryOf(i, statuses)
      return category !== 'done' && category !== 'cancelled'
    })
    .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'))

  const stats = [
    { label: `All ${terminology.tasks.toLowerCase()}`, value: items.length, tone: 'text-slate-900' },
    { label: 'In progress', value: active, tone: 'text-blue-700' },
    { label: 'Done', value: done, tone: 'text-green-700' },
    { label: 'Overdue', value: overdue, tone: overdue > 0 ? 'text-red-600' : 'text-slate-900' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Hello, {session?.user.fullName.split(' ')[0]}</h1>
        <p className="mt-1 text-slate-600">Here is where things stand in {workspace.organization.name}.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-600">{stat.label}</p>
            <p className={cn('mt-1 text-3xl font-bold', stat.tone)}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">My open {terminology.tasks.toLowerCase()}</h2>
          {myOpenWork.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">Nothing assigned to you. Nice!</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {myOpenWork.map((item) => {
                const project = projects.find((p) => p.id === item.projectId)
                return (
                  <li key={item.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <Link to={`/app/projects/${item.projectId}`} className="block truncate text-sm font-medium text-slate-900 hover:text-blue-700">
                        {item.title}
                      </Link>
                      <p className="truncate text-xs text-slate-500">{project?.name}</p>
                    </div>
                    <span className={cn('rounded px-2 py-0.5 text-xs font-medium', priorityStyles[item.priority])}>
                      {priorityLabels[item.priority]}
                    </span>
                    <span className={cn('w-24 text-right text-xs', isOverdue(item, statuses) ? 'font-semibold text-red-600' : 'text-slate-500')}>
                      {formatDate(item.dueDate)}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">{terminology.projects}</h2>
          {projects.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              No {terminology.projects.toLowerCase()} yet. Use the + button in the sidebar to create one.
            </p>
          ) : (
            <ul className="mt-4 space-y-4">
              {projects.map((project) => {
                const progress = completion(
                  items.filter((i) => i.projectId === project.id),
                  statuses,
                )
                return (
                  <li key={project.id}>
                    <div className="flex items-center justify-between text-sm">
                      <Link to={`/app/projects/${project.id}`} className="font-medium text-slate-900 hover:text-blue-700">
                        {project.name}
                      </Link>
                      <span className="text-slate-500">
                        {progress.done}/{progress.total} · {progress.percent}%
                      </span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-green-500" style={{ width: `${progress.percent}%` }} />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          <p className="mt-4 text-xs text-slate-500">Progress = done ÷ all items that are not cancelled.</p>
        </section>
      </div>
    </div>
  )
}
