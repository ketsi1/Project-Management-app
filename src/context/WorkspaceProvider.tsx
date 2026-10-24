import { useEffect, useState, type ReactNode } from 'react'
import { api } from '../api'
import { errorMessage } from '../api/ApiError'
import type { Project, Workspace } from '../types'
import { WorkspaceContext } from './workspaceContext'

// Loads the organization's configuration and project list once after login,
// and shares them with every page inside the app.
export default function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    // If the user leaves before loading finishes, ignore the late answer.
    let cancelled = false
    Promise.all([api.getWorkspace(), api.listProjects()])
      .then(([loadedWorkspace, loadedProjects]) => {
        if (cancelled) return
        setWorkspace(loadedWorkspace)
        setProjects(loadedProjects)
      })
      .catch((e) => {
        if (!cancelled) setError(errorMessage(e))
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function reloadWorkspace() {
    setWorkspace(await api.getWorkspace())
  }

  async function reloadProjects() {
    setProjects(await api.listProjects())
  }

  if (error) {
    return <div className="p-8 text-red-600">Could not load your workspace: {error}</div>
  }

  if (!workspace) {
    return <div className="flex min-h-screen items-center justify-center text-slate-500">Loading workspace…</div>
  }

  return (
    <WorkspaceContext.Provider value={{ workspace, projects, reloadWorkspace, reloadProjects }}>
      {children}
    </WorkspaceContext.Provider>
  )
}
