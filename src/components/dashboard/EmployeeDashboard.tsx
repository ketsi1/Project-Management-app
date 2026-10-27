import { useState } from 'react'
import { Link } from 'react-router'
import { api } from '../../api'
import { errorMessage } from '../../api/ApiError'
import { useAuth } from '../../context/authContext'
import { useWorkspace } from '../../context/workspaceContext'
import type { Priority, WorkItem } from '../../types'
import { pressable, scrollToSection, stopPropagation } from '../../utils/a11y'
import { categoryOf, completion, formatDate, isOverdue, cn } from '../../utils/format'
import WorkItemModal from '../board/WorkItemModal'
import {
  Alert,
  EmptyState,
  OverdueBadge,
  PageHero,
  PriorityBadge,
  ProgressBar,
  SectionHeader,
  StatCard,
} from '../ui/Display'
import Icon from '../ui/Icon'
import { heroButton } from '../ui/styles'

interface EmployeeDashboardProps {
  items: WorkItem[]
  onItemUpdated: () => void
}

type FilterTab = 'all' | 'in_progress' | 'to_do' | 'in_review' | 'done'
type GroupBy = 'status' | 'project' | 'priority'

export default function EmployeeDashboard({ items, onItemUpdated }: EmployeeDashboardProps) {
  const { session, isManager, setActiveViewMode } = useAuth()
  const { workspace, projects } = useWorkspace()
  const { statuses, terminology } = workspace

  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [groupBy, setGroupBy] = useState<GroupBy>('status')
  const [search, setSearch] = useState('')
  const [editingItem, setEditingItem] = useState<WorkItem | null>(null)
  const [creatingTask, setCreatingTask] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [feedbackMessage, setFeedbackMessage] = useState('')

  // Filter tasks strictly assigned to current employee
  const currentUserId = session?.user.id
  const myAllItems = items.filter((i) => i.assigneeId === currentUserId)

  // Status categories
  const myActiveItems = myAllItems.filter((i) => {
    const cat = categoryOf(i, statuses)
    return cat === 'active'
  })
  const myDoneItems = myAllItems.filter((i) => categoryOf(i, statuses) === 'done')
  const myOverdueItems = myAllItems.filter((i) => isOverdue(i, statuses))
  const myTodoItems = myAllItems.filter((i) => categoryOf(i, statuses) === 'not_started')
  const myReviewItems = myAllItems.filter((i) => {
    const status = statuses.find((s) => s.id === i.statusId)
    return status?.name.toLowerCase().includes('review')
  })

  // Quick 1-click status advance for employees
  async function handleQuickAdvance(item: WorkItem, targetStatusId: string) {
    setActionLoading(item.id)
    try {
      await api.updateWorkItem(item.id, { statusId: targetStatusId })
      onItemUpdated()
      const targetStatus = statuses.find((s) => s.id === targetStatusId)
      setFeedbackMessage(`Updated "${item.title}" to ${targetStatus?.name || 'new status'}`)
      setTimeout(() => setFeedbackMessage(''), 3000)
    } catch (e) {
      alert(errorMessage(e))
    } finally {
      setActionLoading(null)
    }
  }

  // Find next status in sequence for 1-click progression
  function getNextStatus(item: WorkItem) {
    const currentIndex = statuses.findIndex((s) => s.id === item.statusId)
    if (currentIndex >= 0 && currentIndex < statuses.length - 1) {
      return statuses[currentIndex + 1]
    }
    return null
  }

  // Find priority spotlight item (most urgent active or overdue task)
  const spotlightItem = [...myAllItems]
    .filter((i) => {
      const cat = categoryOf(i, statuses)
      return cat !== 'done' && cat !== 'cancelled'
    })
    .sort((a, b) => {
      const aOver = isOverdue(a, statuses) ? 1 : 0
      const bOver = isOverdue(b, statuses) ? 1 : 0
      const prioRank: Record<Priority, number> = { urgent: 4, high: 3, medium: 2, low: 1 }
      return bOver - aOver || prioRank[b.priority] - prioRank[a.priority] || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999')
    })[0]

  // Filtered list based on tabs and search
  const visibleItems = myAllItems.filter((item) => {
    if (search && !item.title.toLowerCase().includes(search.toLowerCase())) return false
    const cat = categoryOf(item, statuses)
    const statusName = statuses.find((s) => s.id === item.statusId)?.name.toLowerCase() || ''

    if (activeTab === 'in_progress') return cat === 'active' && !statusName.includes('review')
    if (activeTab === 'to_do') return cat === 'not_started'
    if (activeTab === 'in_review') return statusName.includes('review')
    if (activeTab === 'done') return cat === 'done'
    return true
  })

  // Projects where employee is involved
  const myProjects = projects.filter((project) =>
    myAllItems.some((item) => item.projectId === project.id)
  )

  const employeeFirstName = session?.user.fullName.split(' ')[0] || 'Team Member'

  // KPI tiles: switch the queue tab and scroll to it.
  function showQueue(tab: FilterTab) {
    setActiveTab(tab)
    scrollToSection('queue')
  }

  const tabs: Array<{ id: FilterTab; label: string; count: number }> = [
    { id: 'all', label: 'All', count: myAllItems.length },
    { id: 'in_progress', label: 'In progress', count: myActiveItems.length },
    { id: 'to_do', label: 'To do', count: myTodoItems.length },
    { id: 'in_review', label: 'In review', count: myReviewItems.length },
    { id: 'done', label: 'Done', count: myDoneItems.length },
  ]

  const spotlightNext = spotlightItem ? getNextStatus(spotlightItem) : null

  return (
    <div className="space-y-6 pb-12 sm:space-y-8">
      {/* Welcome banner */}
      <PageHero
        accent="sky"
        eyebrow="My workstation · Individual focus"
        title={`Good day, ${employeeFirstName}`}
        description={
          <>
            You have <span className="font-semibold text-white">{myActiveItems.length} active tasks</span> across{' '}
            {myProjects.length} {terminology.projects.toLowerCase()}.
            {myOverdueItems.length > 0 && (
              <span className="ml-1 font-semibold text-rose-300">{myOverdueItems.length} need immediate attention.</span>
            )}
          </>
        }
        actions={
          <>
            <button type="button" onClick={() => setCreatingTask(true)} className={heroButton.primary}>
              <Icon name="plus" className="h-4 w-4" />
              New task for me
            </button>
            {isManager && (
              <button
                type="button"
                onClick={() => setActiveViewMode('manager')}
                className={heroButton.secondary}
                title="Switch back to Manager Command Center"
              >
                <Icon name="swap" className="h-4 w-4" />
                Manager view
              </button>
            )}
          </>
        }
      />

      {feedbackMessage && <Alert tone="success">{feedbackMessage}</Alert>}

      {/* KPI tiles */}
      <div className="stagger grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Assigned to me"
          value={myAllItems.length}
          hint="Across all active projects"
          icon="inbox"
          tone="indigo"
          active={activeTab === 'all'}
          onClick={() => showQueue('all')}
        />
        <StatCard
          label="In progress"
          value={myActiveItems.length}
          hint="Actively being worked on"
          icon="zap"
          tone="sky"
          active={activeTab === 'in_progress'}
          onClick={() => showQueue('in_progress')}
        />
        <StatCard
          label="Overdue"
          value={myOverdueItems.length}
          hint={myOverdueItems.length > 0 ? 'Requires focus' : 'On schedule'}
          icon="alert"
          tone={myOverdueItems.length > 0 ? 'rose' : 'slate'}
          onClick={spotlightItem ? () => scrollToSection('focus') : undefined}
        />
        <StatCard
          label="Completed"
          value={myDoneItems.length}
          hint="Successfully delivered"
          icon="checkCircle"
          tone="emerald"
          active={activeTab === 'done'}
          onClick={() => showQueue('done')}
        />
      </div>

      {/* Next priority action — the whole card opens the task */}
      {spotlightItem && (
        <section
          id="focus"
          {...pressable(() => setEditingItem(spotlightItem), `Open ${spotlightItem.title}`)}
          className="surface interactive-card group relative scroll-mt-20 overflow-hidden p-5 sm:p-6"
        >
          <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-indigo-500 to-sky-500" aria-hidden="true" />
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                  <Icon name="target" className="h-3 w-3" />
                  Next priority
                </span>
                <PriorityBadge priority={spotlightItem.priority} suffix=" priority" />
                {isOverdue(spotlightItem, statuses) && <OverdueBadge />}
              </div>

              <h2 className="text-lg font-semibold text-slate-900 transition-colors group-hover:text-indigo-700 sm:text-xl">
                {spotlightItem.title}
              </h2>

              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <Icon name="folder" className="h-3.5 w-3.5" />
                  {projects.find((p) => p.id === spotlightItem.projectId)?.name}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Icon name="calendar" className="h-3.5 w-3.5" />
                  Due <span className="font-semibold text-slate-700">{formatDate(spotlightItem.dueDate)}</span>
                </span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2" onClick={stopPropagation} onKeyDown={stopPropagation}>
              {spotlightNext && (
                <button
                  type="button"
                  disabled={actionLoading === spotlightItem.id}
                  onClick={() => {
                    const next = getNextStatus(spotlightItem)
                    if (next) handleQuickAdvance(spotlightItem, next.id)
                  }}
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition-[background-color,scale] hover:bg-indigo-700 active:scale-[0.97] disabled:opacity-50"
                >
                  Move to {spotlightNext.name}
                  <Icon name="arrowRight" className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setEditingItem(spotlightItem)}
                className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-card transition-[background-color,scale] hover:bg-slate-50 active:scale-[0.97]"
              >
                View details
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Work queue */}
      <section id="queue" className="surface scroll-mt-20 p-4 sm:p-6">
        <SectionHeader
          title="My work queue"
          description="Everything assigned to you. Click a task to open it, or change its status right here."
          action={
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search my tasks…"
                  aria-label="Search my tasks"
                  className="input-sm w-full pl-9 sm:w-56"
                />
              </div>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as GroupBy)}
                className="input-sm font-medium text-slate-700"
                aria-label="Group by"
              >
                <option value="status">Group by status</option>
                <option value="project">Group by project</option>
                <option value="priority">Group by priority</option>
              </select>
            </div>
          }
        />

        {/* Tabs */}
        <div className="no-scrollbar -mx-4 mt-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="inline-flex min-w-full gap-1 rounded-lg bg-slate-100 p-1 sm:min-w-0" role="tablist">
            {tabs.map((tab) => {
              const selected = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-200 sm:flex-none',
                    selected ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5' : 'text-slate-500 hover:text-slate-800',
                  )}
                >
                  {tab.label}
                  <span
                    className={cn(
                      'rounded-full px-1.5 text-[10px] tabular-nums leading-4',
                      selected ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600',
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Task rows */}
        {visibleItems.length === 0 ? (
          <EmptyState
            icon="inbox"
            title="No tasks in this view"
            description="You're all caught up, or nothing matches your search."
          />
        ) : (
          <div key={activeTab} className="stagger mt-4 space-y-2.5">
            {visibleItems.map((item) => {
              const project = projects.find((p) => p.id === item.projectId)
              const status = statuses.find((s) => s.id === item.statusId)
              const nextStatus = getNextStatus(item)
              const overdue = isOverdue(item, statuses)
              const isDone = categoryOf(item, statuses) === 'done'

              return (
                <div
                  key={item.id}
                  {...pressable(() => setEditingItem(item), `Open ${item.title}`)}
                  className={cn(
                    'interactive-card group flex flex-col gap-3 rounded-xl border p-3.5 sm:flex-row sm:items-center sm:justify-between sm:p-4',
                    isDone ? 'border-slate-100 bg-slate-50/70' : 'border-slate-200 bg-white',
                  )}
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <PriorityBadge priority={item.priority} />
                      <span className="inline-flex max-w-[12rem] items-center gap-1 truncate rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                        <Icon name="folder" className="h-3 w-3 shrink-0" />
                        <span className="truncate">{project?.name || 'Project'}</span>
                      </span>
                      {overdue && <OverdueBadge />}
                    </div>

                    <p
                      className={cn(
                        'text-sm font-semibold text-slate-900 transition-colors group-hover:text-indigo-700',
                        isDone && 'text-slate-500 line-through',
                      )}
                    >
                      {item.title}
                    </p>

                    <div className="flex min-w-0 items-center gap-3 text-xs text-slate-500">
                      <span className="inline-flex shrink-0 items-center gap-1">
                        <Icon name="calendar" className="h-3.5 w-3.5" />
                        {formatDate(item.dueDate)}
                      </span>
                      {item.description && <span className="hidden truncate text-slate-400 sm:block">{item.description}</span>}
                    </div>
                  </div>

                  {/* Inline status controls (don't open the task) */}
                  <div
                    className="flex shrink-0 items-center gap-2"
                    onClick={stopPropagation}
                    onKeyDown={stopPropagation}
                  >
                    <select
                      value={item.statusId}
                      onChange={(e) => handleQuickAdvance(item, e.target.value)}
                      disabled={actionLoading === item.id}
                      aria-label="Status"
                      className="input-sm h-8 min-w-0 flex-1 text-xs font-semibold sm:flex-none"
                      style={{ color: status?.color }}
                    >
                      {statuses.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>

                    {nextStatus && !isDone && (
                      <button
                        type="button"
                        disabled={actionLoading === item.id}
                        onClick={() => handleQuickAdvance(item, nextStatus.id)}
                        className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-indigo-50 px-2.5 text-xs font-semibold text-indigo-700 transition-[background-color,scale] hover:bg-indigo-100 active:scale-95 disabled:opacity-50"
                        title={`Advance to ${nextStatus.name}`}
                      >
                        {nextStatus.name}
                        <Icon name="arrowRight" className="h-3.5 w-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setEditingItem(item)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                      title="Open details"
                      aria-label="Open details"
                    >
                      <Icon name="pencil" className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* My projects */}
      <section className="space-y-4">
        <SectionHeader
          title={`My ${terminology.projects.toLowerCase()}`}
          description="Where you're contributing. Click a card to open its board."
        />

        {myProjects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white">
            <EmptyState icon="folder" title="No projects yet" description="Projects appear here once you're assigned a task." />
          </div>
        ) : (
          <div className="stagger grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
            {myProjects.map((project) => {
              const projectItems = items.filter((i) => i.projectId === project.id)
              const myProjectItems = projectItems.filter((i) => i.assigneeId === currentUserId)
              const myProjectDone = myProjectItems.filter((i) => categoryOf(i, statuses) === 'done').length
              const projectProgress = completion(projectItems, statuses)

              return (
                <Link
                  key={project.id}
                  to={`/app/projects/${project.id}`}
                  className="surface interactive-card group flex flex-col p-5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sm font-bold uppercase text-sky-600 ring-1 ring-inset ring-sky-100">
                        {project.name.charAt(0)}
                      </span>
                      <h3 className="truncate font-semibold text-slate-900 transition-colors group-hover:text-indigo-700">
                        {project.name}
                      </h3>
                    </div>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      {projectProgress.percent}% team done
                    </span>
                  </div>

                  <p className="mt-2 line-clamp-2 text-sm text-slate-500">{project.description || 'Collaborative initiative.'}</p>

                  <div className="mt-4 rounded-lg bg-slate-50 p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">Your contribution</span>
                      <span className="tabular-nums text-slate-500">
                        <span className="font-semibold text-slate-900">{myProjectDone}</span> / {myProjectItems.length} done
                      </span>
                    </div>
                    <ProgressBar
                      percent={myProjectItems.length > 0 ? (myProjectDone / myProjectItems.length) * 100 : 0}
                      tone="emerald"
                      className="mt-2 bg-slate-200"
                    />
                  </div>

                  <div className="min-h-4 flex-1" />
                  <span className="inline-flex items-center gap-1 border-t border-slate-100 pt-3 text-xs font-semibold text-slate-400 transition-colors group-hover:text-indigo-600">
                    Open board
                    <Icon name="arrowRight" className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* Modals */}
      {editingItem && (
        <WorkItemModal
          key={editingItem.id}
          projectId={editingItem.projectId}
          item={editingItem}
          defaultStatusId={statuses[0]?.id ?? ''}
          onClose={() => setEditingItem(null)}
          onSaved={() => {
            setEditingItem(null)
            onItemUpdated()
          }}
        />
      )}

      {creatingTask && (
        <WorkItemModal
          key="new-task"
          projectId={projects[0]?.id ?? ''}
          item={null}
          defaultStatusId={statuses[0]?.id ?? ''}
          onClose={() => setCreatingTask(false)}
          onSaved={() => {
            setCreatingTask(false)
            onItemUpdated()
          }}
        />
      )}
    </div>
  )
}
