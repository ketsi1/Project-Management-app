import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../../context/authContext'
import type { Permission } from '../../types'
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

// Pages that need at least one of the given permissions. Anyone else is sent back to the dashboard.
// The backend checks the same permissions, so this only stops the page from showing.
export function RequirePermission({ anyOf }: { anyOf: Permission[] }) {
  const { canAny } = useAuth()
  if (!canAny(...anyOf)) return <Navigate to="/app" replace />
  return <Outlet />
}

// Login and registration: only for people who are NOT logged in.
export function PublicOnlyRoute() {
  const { session } = useAuth()
  if (session) return <Navigate to="/app" replace />
  return <Outlet />
}
