import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { usingMockApi } from '../../api'
import { useAuth } from '../../context/authContext'
import { useWorkspace } from '../../context/workspaceContext'
import { cn } from '../../utils/format'
import ProjectFormModal from '../board/ProjectFormModal'
import Avatar from '../ui/Avatar'
import BrandMark from '../ui/BrandMark'
import Icon, { type IconName } from '../ui/Icon'

const DEMO_PERSONAS: Array<{ email: string; name: string; role: string; icon: IconName }> = [
  { email: 'alex@acme.com', name: 'Alex Morgan', role: 'Project Manager / Boss', icon: 'briefcase' },
  { email: 'sarah@acme.com', name: 'Sarah Connor', role: 'Developer (Employee)', icon: 'code' },
  { email: 'david@acme.com', name: 'David Kim', role: 'Designer (Employee)', icon: 'palette' },
]

export default function AppLayout() {
  const { session, logout, isManager, activeViewMode, setActiveViewMode, switchDemoUser } = useAuth()
  const { workspace, projects } = useWorkspace()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [creatingProject, setCreatingProject] = useState(false)
  const [demoMenuOpen, setDemoMenuOpen] = useState(false)

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

  async function handleSwitchPersona(email: string) {
    if (switchDemoUser) {
      await switchDemoUser(email)
      setDemoMenuOpen(false)
      setMenuOpen(false)
      navigate('/app')
    }
  }

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
        {/* View mode switcher (managers) */}
        {isManager && (
          <div>
            <p className="eyebrow mb-2 px-3">View mode</p>
            <div className="relative grid grid-cols-2 rounded-lg bg-slate-100 p-1" role="tablist" aria-label="View mode">
              <span
                aria-hidden="true"
                className={cn(
                  'absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-md bg-white shadow-sm ring-1 ring-slate-900/5 transition-transform duration-300 ease-out-expo',
                  activeViewMode === 'employee' && 'translate-x-full',
                )}
              />
              {(
                [
                  { mode: 'manager', label: 'Manager', icon: 'briefcase' },
                  { mode: 'employee', label: 'Employee', icon: 'user' },
                ] as const
              ).map(({ mode, label, icon }) => (
                <button
                  key={mode}
                  type="button"
                  role="tab"
                  aria-selected={activeViewMode === mode}
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveViewMode(mode)
                  }}
                  className={cn(
                    'relative z-10 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-colors',
                    activeViewMode === mode ? 'text-indigo-700' : 'text-slate-500 hover:text-slate-800',
                  )}
                >
                  <Icon name={icon} className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div>
          <p className="eyebrow mb-2 px-3">Navigation</p>
          <div className="space-y-0.5">
            <NavLink to="/app" end className={linkClass}>
              <Icon name={activeViewMode === 'manager' ? 'dashboard' : 'target'} className="h-[18px] w-[18px] shrink-0" />
              <span className="truncate">{activeViewMode === 'manager' ? 'Executive Dashboard' : 'My Workstation'}</span>
            </NavLink>

            {isManager && (
              <NavLink to="/app/settings" className={linkClass}>
                <Icon name="settings" className="h-[18px] w-[18px] shrink-0" />
                <span className="truncate">Workspace Settings</span>
              </NavLink>
            )}
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

      {/* Footer: demo switcher + user */}
      <div className="shrink-0 space-y-2 border-t border-slate-100 p-3">
        {usingMockApi && (
          <div className="relative">
            <button
              type="button"
              aria-expanded={demoMenuOpen}
              onClick={(e) => {
                e.stopPropagation()
                setDemoMenuOpen(!demoMenuOpen)
              }}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-dashed border-indigo-200 bg-indigo-50/50 px-3 py-2 text-left text-xs font-semibold text-indigo-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50"
            >
              <span className="flex items-center gap-2">
                <Icon name="swap" className="h-3.5 w-3.5" />
                Switch demo persona
              </span>
              <Icon
                name="chevronDown"
                className={cn('h-3.5 w-3.5 transition-transform duration-200', demoMenuOpen && 'rotate-180')}
              />
            </button>

            {demoMenuOpen && (
              <div
                className="absolute bottom-full left-0 z-50 mb-2 w-full space-y-0.5 rounded-xl border border-slate-200 bg-white p-1.5 shadow-pop animate-scale-in"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="eyebrow px-2 py-1.5">Demo personas</p>
                {DEMO_PERSONAS.map((persona) => {
                  const current = session?.user.email === persona.email
                  return (
                    <button
                      key={persona.email}
                      type="button"
                      onClick={() => handleSwitchPersona(persona.email)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-xs transition-colors',
                        current ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
                          current ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500',
                        )}
                      >
                        <Icon name={persona.icon} className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{persona.name}</span>
                        <span className="block truncate text-[11px] text-slate-400">{persona.role}</span>
                      </span>
                      {current && <Icon name="check" className="h-3.5 w-3.5 shrink-0 text-indigo-600" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

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
