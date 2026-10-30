import { createContext, useContext } from 'react'
import type { Project, Workspace } from '../types'

export interface WorkspaceContextValue {
  workspace: Workspace
  projects: Project[]
  reloadWorkspace: () => Promise<void>
  reloadProjects: () => Promise<void>
}

// The shared "box" that holds the organization's configuration and projects.
export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function useWorkspace(): WorkspaceContextValue {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error('useWorkspace must be used inside <WorkspaceProvider>')
  return value
}
