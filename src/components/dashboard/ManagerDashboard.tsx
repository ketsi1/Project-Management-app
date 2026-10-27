import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../context/authContext'
import { useWorkspace } from '../../context/workspaceContext'
import type { WorkItem } from '../../types'
import { pressable, scrollToSection } from '../../utils/a11y'
import { categoryOf, completion, formatDate, isOverdue, cn } from '../../utils/format'
import ProjectFormModal from '../board/ProjectFormModal'
import WorkItemModal from '../board/WorkItemModal'
import Avatar from '../ui/Avatar'
import Button from '../ui/Button'
import {
  Alert,
  EmptyState,
  OverdueBadge,
  PageHero,
  PriorityBadge,
  ProgressBar,
  SectionHeader,
  StatCard,
  StatusPill,
} from '../ui/Display'
import Icon from '../ui/Icon'
import { heroButton } from '../ui/styles'

interface ManagerDashboardProps {
  items: WorkItem[]
  onItemUpdated: () => void
}

export default function ManagerDashboard({ items, onItemUpdated }: ManagerDashboardProps) {
  const { session, setActiveViewMode } = useAuth()
  const { workspace, projects, reloadProjects } = useWorkspace()
  const { statuses, members, terminology } = workspace
  const navigate = useNavigate()

  const [creatingProject, setCreatingProject] = useState(false)
  const [editingItem, setEditingItem] = useState<WorkItem | null>(null)
  const [creatingItem, setCreatingItem] = useState(false)
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string | null>(null)
  const [quickError, setQuickError] = useState('')

  // High-level aggregate metrics across all projects
  const activeItems = items.filter((i) => categoryOf(i, statuses) === 'active')
  const doneItems = items.filter((i) => categoryOf(i, statuses) === 'done')
  const inReviewItems = items.filter((i) => {
    const status = statuses.find((s) => s.id === i.statusId)
    return status?.name.toLowerCase().includes('review')
  })
  const overdueItems = items.filter((i) => isOverdue(i, statuses))
  const unassignedItems = items.filter((i) => !i.assigneeId && categoryOf(i, statuses) !== 'done')

  const overallProgress = completion(items, statuses)

  // Team workload analysis
  const memberWorkload = members.map((member) => {
    const memberTasks = items.filter((i) => i.assigneeId === member.id)
    const activeTasks = memberTasks.filter((i) => {
      const cat = categoryOf(i, statuses)
      return cat !== 'done' && cat !== 'cancelled'
    })
    const overdue = memberTasks.filter((i) => isOverdue(i, statuses))
    const completed = memberTasks.filter((i) => categoryOf(i, statuses) === 'done')

    let loadStatus: { label: string; color: string; badge: string } = {
      label: 'Available',
      color: 'bg-emerald-500',
      badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    }
    if (activeTasks.length >= 5) {
      loadStatus = {
        label: 'Overloaded',
        color: 'bg-rose-500',
        badge: 'bg-rose-50 text-rose-700 ring-rose-200',
      }
    } else if (activeTasks.length >= 3) {
      loadStatus = {
        label: 'Heavy Load',
        color: 'bg-amber-500',
        badge: 'bg-amber-50 text-amber-700 ring-amber-200',
      }
    } else if (activeTasks.length > 0) {
      loadStatus = {
        label: 'Balanced',
        color: 'bg-indigo-500',
        badge: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
      }
    }

    return {
      member,
      total: memberTasks.length,
      active: activeTasks.length,
      overdue: overdue.length,
      completed: completed.length,
      tasks: activeTasks,
      loadStatus,
    }
  })

  // Urgent bottlenecks: Overdue or high/urgent priority active tasks
  const urgentBottlenecks = items
    .filter((i) => {
      const cat = categoryOf(i, statuses)
      if (cat === 'done' || cat === 'cancelled') return false
      return isOverdue(i, statuses) || i.priority === 'urgent' || i.priority === 'high'
    })
    .sort((a, b) => {
      const aOver = isOverdue(a, statuses) ? 1 : 0
      const bOver = isOverdue(b, statuses) ? 1 : 0
      return bOver - aOver || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999')
    })
    .slice(0, 6)

  // Filtered view by selected team member if clicked
  const filteredItems = selectedMemberFilter
    ? items.filter((i) => i.assigneeId === selectedMemberFilter)
    : []
  const filteredMember = members.find((m) => m.id === selectedMemberFilter)

  return (
    <div className="space-y-6 pb-12 sm:space-y-8">
      {/* Welcome banner */}
      <PageHero
        eyebrow="Executive hub · Manager view"
        title="Portfolio & Operations"
        description={
          <>
            Welcome back, {session?.user.fullName}. Oversight of {workspace.organization.name}’s projects, team capacity
            and critical delivery milestones.
          </>
        }
        actions={
          <>
            <button type="button" onClick={() => setCreatingItem(true)} className={heroButton.primary}>
              <Icon name="plus" className="h-4 w-4" />
              New {terminology.task}
            </button>
            <button type="button" onClick={() => setCreatingProject(true)} className={heroButton.secondary}>
              <Icon name="folder" className="h-4 w-4" />
              New {terminology.project}
            </button>
            <button
              type="button"
              onClick={() => setActiveViewMode('employee')}
              className={heroButton.secondary}
              title="Switch to personal Employee Workstation"
            >
              <Icon name="swap" className="h-4 w-4" />
              <span className="hidden sm:inline">Employee view</span>
              <span className="sm:hidden">Switch</span>
            </button>
          </>
        }
      />

      {quickError && (
        <Alert action={<button type="button" onClick={() => setQuickError('')} aria-label="Dismiss"><Icon name="x" className="h-4 w-4" /></button>}>
          {quickError}
        </Alert>
      )}

      {/* KPI tiles — each one jumps to the section it summarises */}
      <div className="stagger grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label={`Active ${terminology.projects}`}
          value={projects.length}
          hint="Across entire workspace"
          icon="folder"
          tone="indigo"
          onClick={() => scrollToSection('portfolio')}
        />
        <StatCard
          label={`Total ${terminology.tasks}`}
          value={items.length}
          hint={`${activeItems.length} active · ${doneItems.length} done${inReviewItems.length ? ` · ${inReviewItems.length} in review` : ''}`}
          icon="clipboard"
          tone="sky"
          onClick={() => scrollToSection('portfolio')}
        />
        <StatCard label="Org velocity" value={`${overallProgress.percent}%`} icon="trendingUp" tone="emerald">
          <ProgressBar percent={overallProgress.percent} tone="emerald" className="mt-3" />
        </StatCard>
        <StatCard
          label="Overdue alerts"
          value={overdueItems.length}
          hint={overdueItems.length > 0 ? 'Requires immediate triage' : 'All milestones on schedule'}
          icon="alert"
          tone={overdueItems.length > 0 ? 'rose' : 'slate'}
          onClick={() => scrollToSection('bottlenecks')}
        />
        <StatCard
          label="Team headcount"
          value={members.length}
          hint={unassignedItems.length > 0 ? `${unassignedItems.length} unassigned tasks` : 'All tasks allocated'}
          icon="users"
          tone="violet"
          onClick={() => scrollToSection('team')}
        />
      </div>

      {/* Team capacity */}
      <section id="team" className="surface scroll-mt-20 p-4 sm:p-6">
        <SectionHeader
          title="Team capacity & workload"
          badge={
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              {members.length} members
            </span>
          }
          description="Select a person to see everything assigned to them."
          action={
            <Link
              to="/app/settings"
              className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 transition-colors hover:text-indigo-700"
            >
              Manage members
              <Icon name="chevronRight" className="h-4 w-4" />
            </Link>
          }
        />

        <div className="stagger mt-5 grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
          {memberWorkload.map(({ member, active, overdue, completed, loadStatus }) => {
            const isSelected = selectedMemberFilter === member.id
            return (
              <div
                key={member.id}
                {...pressable(() => setSelectedMemberFilter(isSelected ? null : member.id))}
                aria-pressed={isSelected}
                className={cn(
                  'interactive-card group rounded-xl border p-4',
                  isSelected ? 'border-indigo-400 bg-indigo-50/40 ring-2 ring-indigo-500/15' : 'border-slate-200 bg-white',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={member.fullName} size="md" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{member.fullName}</p>
                      <p className="truncate text-xs text-slate-500">{member.email}</p>
                    </div>
                  </div>
                  <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset', loadStatus.badge)}>
                    {loadStatus.label}
                  </span>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Active workload</span>
                    <span className="font-semibold tabular-nums text-slate-900">{active} active</span>
                  </div>
                  <ProgressBar percent={(active / 6) * 100} colorClass={loadStatus.color} className="mt-1.5" />
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-t border-slate-100 pt-3 text-xs whitespace-nowrap">
                  <span className="text-slate-500">{completed} done</span>
                  {overdue > 0 ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-rose-600">
                      <Icon name="alert" className="h-3.5 w-3.5" />
                      {overdue} overdue
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-emerald-600">
                      <Icon name="check" className="h-3.5 w-3.5" />
                      On schedule
                    </span>
                  )}
                  <span
                    className={cn(
                      'inline-flex items-center gap-0.5 font-semibold transition-colors',
                      isSelected ? 'text-indigo-700' : 'text-slate-400 group-hover:text-indigo-600',
                    )}
                  >
                    {isSelected ? 'Hide' : 'View tasks'}
                    <Icon
                      name="chevronDown"
                      className={cn('h-3.5 w-3.5 transition-transform duration-200', isSelected && 'rotate-180')}
                    />
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Drill-down for the selected member */}
        {selectedMemberFilter && filteredMember && (
          <div key={selectedMemberFilter} className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 animate-fade-in-up sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <Avatar name={filteredMember.fullName} size="sm" />
                <h3 className="truncate text-sm font-semibold text-slate-900">
                  {filteredMember.fullName}’s tasks <span className="font-normal text-slate-500">({filteredItems.length})</span>
                </h3>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedMemberFilter(null)}>
                <Icon name="x" className="h-3.5 w-3.5" />
                Clear
              </Button>
            </div>

            {filteredItems.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No tasks currently assigned to this member.</p>
            ) : (
              <div className="stagger mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {filteredItems.map((item) => {
                  const proj = projects.find((p) => p.id === item.projectId)
                  const st = statuses.find((s) => s.id === item.statusId)
                  return (
                    <div
                      key={item.id}
                      {...pressable(() => setEditingItem(item))}
                      className="interactive-card group rounded-lg border border-slate-200 bg-white p-3"
                    >
                      <p className="line-clamp-2 text-sm font-semibold text-slate-900 transition-colors group-hover:text-indigo-700">
                        {item.title}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500">
                        <span className="truncate">{proj?.name}</span>
                        <StatusPill status={st} className="shrink-0" />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Portfolio + bottlenecks */}
      <div className="grid gap-6 sm:gap-8 xl:grid-cols-3">
        <section id="portfolio" className="scroll-mt-20 space-y-4 xl:col-span-2">
          <SectionHeader
            title={`${terminology.projects} portfolio`}
            description="Active initiatives and delivery progress across teams."
            action={
              <Button variant="secondary" size="sm" onClick={() => setCreatingProject(true)}>
                <Icon name="plus" className="h-3.5 w-3.5" />
                New {terminology.project}
              </Button>
            }
          />

          {projects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white">
              <EmptyState
                icon="folder"
                title="No projects yet"
                description="Create your first project to start planning work."
                action={<Button onClick={() => setCreatingProject(true)}>Create your first project</Button>}
              />
            </div>
          ) : (
            <div className="stagger grid gap-3 sm:grid-cols-2 sm:gap-4">
              {projects.map((project) => {
                const projectItems = items.filter((i) => i.projectId === project.id)
                const progress = completion(projectItems, statuses)
                const overdueCount = projectItems.filter((i) => isOverdue(i, statuses)).length

                return (
                  <Link
                    key={project.id}
                    to={`/app/projects/${project.id}`}
                    className="surface interactive-card group flex flex-col p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-sm font-bold uppercase text-indigo-600 ring-1 ring-inset ring-indigo-100">
                          {project.name.charAt(0)}
                        </span>
                        <h3 className="truncate font-semibold text-slate-900 transition-colors group-hover:text-indigo-700">
                          {project.name}
                        </h3>
                      </div>
                      {overdueCount > 0 && <OverdueBadge label={`${overdueCount} overdue`} />}
                    </div>

                    <p className="mt-2 line-clamp-2 text-sm text-slate-500">
                      {project.description || 'No description provided.'}
                    </p>

                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Completion</span>
                        <span className="font-semibold tabular-nums text-slate-900">
                          {progress.done}/{progress.total} · {progress.percent}%
                        </span>
                      </div>
                      <ProgressBar percent={progress.percent} tone="emerald" className="mt-1.5" />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {statuses.map((status) => {
                        const count = projectItems.filter((i) => i.statusId === status.id).length
                        if (count === 0) return null
                        return (
                          <span
                            key={status.id}
                            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium"
                            style={{ backgroundColor: `${status.color}14`, color: status.color }}
                          >
                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: status.color }} />
                            {status.name} · {count}
                          </span>
                        )
                      })}
                    </div>

                    <div className="min-h-5 flex-1" />
                    <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                      <span className="text-xs text-slate-400">
                        {projectItems.length} {terminology.tasks.toLowerCase()}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 transition-colors group-hover:text-indigo-600">
                        Open board
                        <Icon name="arrowRight" className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        <section id="bottlenecks" className="scroll-mt-20 space-y-4">
          <SectionHeader
            title="Urgent bottlenecks"
            badge={
              urgentBottlenecks.length > 0 && (
                <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
                  {urgentBottlenecks.length}
                </span>
              )
            }
            description="Overdue and high-priority work."
          />

          <div className="surface overflow-hidden">
            {urgentBottlenecks.length === 0 ? (
              <EmptyState
                icon="checkCircle"
                title="No overdue or blocked deliverables"
                description="All milestones across projects are on track."
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {urgentBottlenecks.map((item) => {
                  const project = projects.find((p) => p.id === item.projectId)
                  const assignee = members.find((m) => m.id === item.assigneeId)
                  const overdue = isOverdue(item, statuses)

                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setEditingItem(item)}
                        className="group block w-full px-4 py-3.5 text-left transition-colors hover:bg-slate-50 focus-visible:bg-slate-50"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-900 transition-colors group-hover:text-indigo-700">
                              {item.title}
                            </p>
                            <p className="truncate text-xs text-slate-500">{project?.name}</p>
                          </div>
                          <PriorityBadge priority={item.priority} className="shrink-0" />
                        </div>

                        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                          <span className="flex min-w-0 items-center gap-1.5 text-slate-600">
                            <Avatar name={assignee?.fullName ?? 'Unassigned'} size="sm" />
                            <span className="truncate">{assignee ? assignee.fullName : 'Unassigned'}</span>
                          </span>
                          <span
                            className={cn(
                              'inline-flex shrink-0 items-center gap-1',
                              overdue ? 'font-semibold text-rose-600' : 'text-slate-500',
                            )}
                          >
                            <Icon name={overdue ? 'alert' : 'calendar'} className="h-3.5 w-3.5" />
                            {formatDate(item.dueDate)}
                          </span>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* Modals */}
      {creatingProject && (
        <ProjectFormModal
          project={null}
          onClose={() => setCreatingProject(false)}
          onSaved={async (project) => {
            setCreatingProject(false)
            await reloadProjects()
            navigate(`/app/projects/${project.id}`)
          }}
        />
      )}

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

      {creatingItem && (
        <WorkItemModal
          key="manager-create-task"
          projectId={projects[0]?.id ?? ''}
          item={null}
          defaultStatusId={statuses[0]?.id ?? ''}
          onClose={() => setCreatingItem(false)}
          onSaved={() => {
            setCreatingItem(false)
            onItemUpdated()
          }}
        />
      )}
    </div>
  )
}
