import { Navigate, Route, Routes } from 'react-router'
import { ProtectedRoute, PublicOnlyRoute } from './components/layout/RouteGuards'
import DashboardPage from './pages/DashboardPage'
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
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  )
}
