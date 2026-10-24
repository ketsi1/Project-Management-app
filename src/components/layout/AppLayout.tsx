import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../../context/authContext'
import { useWorkspace } from '../../context/workspaceContext'
import { cn } from '../../utils/format'
import ProjectFormModal from '../board/ProjectFormModal'
import Avatar from '../ui/Avatar'

// The frame around every page after login: sidebar on the left, page on the right.
export default function AppLayout() {
  const { session, logout } = useAuth()
  const { workspace, projects } = useWorkspace()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [creatingProject, setCreatingProject] = useState(false)

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'block truncate rounded-lg px-3 py-2 text-sm',
      isActive ? 'bg-blue-50 font-medium text-blue-700' : 'text-slate-700 hover:bg-slate-100',
    )

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const sidebar = (
    <nav className="flex h-full flex-col gap-6 p-4" onClick={() => setMenuOpen(false)}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Organization</p>
        <p className="mt-1 truncate font-bold text-slate-900">{workspace.organization.name}</p>
      </div>

      <div className="space-y-1">
        <NavLink to="/app" end className={linkClass}>
          Dashboard
        </NavLink>
        <NavLink to="/app/settings" className={linkClass}>
          Settings
        </NavLink>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{workspace.terminology.projects}</p>
          <button
            onClick={(event) => {
              event.stopPropagation()
              setCreatingProject(true)
            }}
            className="rounded px-2 text-lg leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label={`New ${workspace.terminology.project}`}
          >
            +
          </button>
        </div>
        <div className="space-y-1">
          {projects.map((project) => (
            <NavLink key={project.id} to={`/app/projects/${project.id}`} className={linkClass}>
              {project.name}
            </NavLink>
          ))}
          {projects.length === 0 && <p className="px-3 text-sm text-slate-500">None yet</p>}
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-slate-200 pt-4">
        <Avatar name={session?.user.fullName ?? '?'} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900">{session?.user.fullName}</p>
          <button onClick={handleLogout} className="text-xs text-slate-500 hover:text-slate-900">
            Log out
          </button>
        </div>
      </div>
    </nav>
  )

  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      {/* Top bar on phones */}
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <span className="font-bold text-slate-900">{workspace.organization.name}</span>
        <button onClick={() => setMenuOpen(true)} className="rounded border border-slate-300 px-3 py-1 text-sm">
          Menu
        </button>
      </header>

      {/* Sidebar on laptops */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white md:block md:h-screen md:sticky md:top-0">
        {sidebar}
      </aside>

      {/* Sliding sidebar on phones */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/40 md:hidden" onClick={() => setMenuOpen(false)}>
          <aside className="h-full w-72 bg-white" onClick={(event) => event.stopPropagation()}>
            {sidebar}
          </aside>
        </div>
      )}

      <main className="min-w-0 flex-1 p-4 sm:p-6">
        <Outlet />
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
