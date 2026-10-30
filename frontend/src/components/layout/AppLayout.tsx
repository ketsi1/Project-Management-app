import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../../context/authContext'
import { useWorkspace } from '../../context/workspaceContext'
import { cn } from '../../utils/format'
import ProjectFormModal from '../board/ProjectFormModal'
import Avatar from '../ui/Avatar'
import BrandMark from '../ui/BrandMark'
import Icon, { type IconName } from '../ui/Icon'

export default function AppLayout() {
  const { session, logout, isManager, activeViewMode } = useAuth()
  const { workspace, projects } = useWorkspace()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [creatingProject, setCreatingProject] = useState(false)

  // Mobile drawer: close with Escape and stop the page behind it from scrolling.
  useEffect(() => {
    if (!menuOpen) return
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKey)
      document.body.style.overflow = previousOverflow
    }
  }, [menuOpen])

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150',
      isActive
        ? 'bg-indigo-50 text-indigo-700 before:absolute before:-left-3 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-r-full before:bg-indigo-600'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
    )

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  // Side tabs depend only on the role: managers and employees each get their own set.
  const tasksWord = workspace.terminology.tasks
  const pendingCount = workspace.pendingMembers?.length ?? 0
  const navItems: Array<{ to: string; label: string; icon: IconName; badge?: number }> =
    activeViewMode === 'manager'
      ? [
          { to: '/app', label: 'Executive Dashboard', icon: 'dashboard' },
          { to: '/app/tasks', label: `All ${tasksWord}`, icon: 'list' },
          { to: '/app/deadlines', label: 'Deadlines', icon: 'calendar' },
          { to: '/app/team', label: 'Team', icon: 'users' },
          { to: '/app/approvals', label: 'Approvals', icon: 'checkCircle', badge: pendingCount },
          { to: '/app/settings', label: 'Workspace Settings', icon: 'settings' },
        ]
      : [
          { to: '/app', label: 'My Workstation', icon: 'target' },
          { to: '/app/tasks', label: `My ${tasksWord}`, icon: 'list' },
          { to: '/app/deadlines', label: 'Deadlines', icon: 'calendar' },
        ]

  const roleLabel =
    session?.role === 'owner'
      ? 'Owner / Boss'
      : session?.role === 'admin'
        ? 'Project Manager'
        : 'Team Member'

  const sidebar = (
    <nav className="flex h-full flex-col" aria-label="Main" onClick={() => setMenuOpen(false)}>
      {/* Brand */}
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-100 px-5">
        <BrandMark />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-900">{workspace.organization.name}</p>
          <p className="text-xs font-medium text-slate-500">{isManager ? 'Manager workspace' : 'Employee workspace'}</p>
        </div>
        {/* Close button (mobile drawer only) */}
        <button
          type="button"
          onClick={() => setMenuOpen(false)}
          className="-mr-2 flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 md:hidden"
          aria-label="Close menu"
        >
          <Icon name="x" className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {/* Navigation */}
        <div>
          <p className="eyebrow mb-2 px-3">Navigation</p>
          <div className="space-y-0.5">
            {navItems.map((nav) => (
              <NavLink key={nav.to} to={nav.to} end={nav.to === '/app'} className={linkClass}>
                <Icon name={nav.icon} className="h-[18px] w-[18px] shrink-0" />
                <span className="flex-1 truncate">{nav.label}</span>
                {nav.badge ? (
                  <span className="rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-800 tabular-nums">{nav.badge}</span>
                ) : null}
              </NavLink>
            ))}
          </div>
        </div>

        {/* Projects */}
        <div>
          <div className="mb-2 flex items-center justify-between px-3">
            <p className="eyebrow">{workspace.terminology.projects}</p>
            {isManager && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  setCreatingProject(true)
                }}
                className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                title={`New ${workspace.terminology.project}`}
                aria-label={`New ${workspace.terminology.project}`}
              >
                <Icon name="plus" className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="max-h-[40vh] space-y-0.5 overflow-y-auto md:max-h-64">
            {projects.map((project) => (
              <NavLink key={project.id} to={`/app/projects/${project.id}`} className={linkClass}>
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded text-[10px] font-bold uppercase',
                        isActive ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 group-hover:bg-slate-300',
                      )}
                    >
                      {project.name.charAt(0)}
                    </span>
                    <span className="truncate">{project.name}</span>
                  </>
                )}
              </NavLink>
            ))}
            {projects.length === 0 && <p className="px-3 py-2 text-xs text-slate-400">No projects yet</p>}
          </div>
        </div>
      </div>

      {/* Footer: user */}
      <div className="shrink-0 space-y-2 border-t border-slate-100 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
          <Avatar name={session?.user.fullName ?? '?'} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{session?.user.fullName}</p>
            <p className="truncate text-xs text-slate-500">{roleLabel}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
            title="Log out"
            aria-label="Log out"
          >
            <Icon name="logout" className="h-4 w-4" />
          </button>
        </div>
      </div>
    </nav>
  )

  return (
    <div className="min-h-dvh bg-slate-50 md:flex">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-slate-200/80 bg-white/85 px-4 backdrop-blur-md md:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <BrandMark className="h-7 w-7" />
          <span className="truncate text-sm font-bold text-slate-900">{workspace.organization.name}</span>
        </div>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-card transition-colors hover:bg-slate-50 active:scale-95"
          aria-label="Open menu"
          aria-expanded={menuOpen}
        >
          <Icon name="menu" className="h-[18px] w-[18px]" />
        </button>
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-200/80 bg-white md:sticky md:top-0 md:block md:h-dvh">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px] animate-fade-in md:hidden"
          onClick={() => setMenuOpen(false)}
        >
          <aside
            className="h-full w-[min(18rem,85vw)] bg-white shadow-pop animate-slide-in-left"
            onClick={(event) => event.stopPropagation()}
          >
            {sidebar}
          </aside>
        </div>
      )}

      {/* Page content */}
      <main className="min-w-0 flex-1">
        <div key={location.pathname} className="mx-auto w-full max-w-[1440px] px-4 py-5 animate-fade-in sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <Outlet />
        </div>
      </main>

      {creatingProject && (
        <ProjectFormModal
          project={null}
          onClose={() => setCreatingProject(false)}
          onSaved={(project) => navigate(`/app/projects/${project.id}`)}
        />
      )}
    </div>
  )
}
