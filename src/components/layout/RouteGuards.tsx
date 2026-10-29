import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../../context/authContext'
import WorkspaceProvider from '../../context/WorkspaceProvider'
import AppLayout from './AppLayout'

// Pages inside the app: only for logged-in users.
export function ProtectedRoute() {
  const { session } = useAuth()
  if (!session) return <Navigate to="/login" replace />
  return (
    <WorkspaceProvider>
      <AppLayout />
    </WorkspaceProvider>
  )
}

// Manager-only pages (workspace settings). Employees are sent back to their own workstation.
// The backend enforces the same rule, so this only stops the page from showing.
export function ManagerOnlyRoute() {
  const { isManager } = useAuth()
  if (!isManager) return <Navigate to="/app" replace />
  return <Outlet />
}

// Login and registration: only for people who are NOT logged in.
export function PublicOnlyRoute() {
  const { session } = useAuth()
  if (session) return <Navigate to="/app" replace />
  return <Outlet />
}
