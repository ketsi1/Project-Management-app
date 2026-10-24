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

// Login and registration: only for people who are NOT logged in.
export function PublicOnlyRoute() {
  const { session } = useAuth()
  if (session) return <Navigate to="/app" replace />
  return <Outlet />
}
