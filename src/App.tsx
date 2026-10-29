import { Navigate, Route, Routes } from 'react-router'
import { ManagerOnlyRoute, ProtectedRoute, PublicOnlyRoute } from './components/layout/RouteGuards'
import ApprovalsPage from './pages/ApprovalsPage'
import DashboardPage from './pages/DashboardPage'
import DeadlinesPage from './pages/DeadlinesPage'
import TasksPage from './pages/TasksPage'
import TeamPage from './pages/TeamPage'
import LoginPage from './pages/LoginPage'
import ProjectPage from './pages/ProjectPage'
import RegisterPage from './pages/RegisterPage'
import SettingsPage from './pages/SettingsPage'

// Which page appears for which address.
export default function App() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route path="/app" element={<ProtectedRoute />}>
        <Route index element={<DashboardPage />} />
        <Route path="projects/:projectId" element={<ProjectPage />} />
        {/* Shared tabs: each role only sees its own scope (managers: everyone, employees: themselves). */}
        <Route path="tasks" element={<TasksPage />} />
        <Route path="deadlines" element={<DeadlinesPage />} />
        <Route element={<ManagerOnlyRoute />}>
          <Route path="team" element={<TeamPage />} />
          <Route path="approvals" element={<ApprovalsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  )
}
