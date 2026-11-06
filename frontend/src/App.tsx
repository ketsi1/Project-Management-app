import { Navigate, Route, Routes, useLocation, useParams } from 'react-router'
import { ProtectedRoute, PublicOnlyRoute, RequirePermission } from './components/layout/RouteGuards'
import AcceptInvitePage from './pages/AcceptInvitePage'
import { SETTINGS_PERMISSIONS } from './utils/permissions'
import DashboardPage from './pages/DashboardPage'
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
        <Route path="/accept-invite" element={<AcceptInvitePage />} />
      </Route>

      <Route path="/app" element={<ProtectedRoute />}>
        <Route index element={<DashboardPage />} />
        <Route path="projects/:projectId" element={<ProjectPage />} />
        {/* Shared tabs: each role only sees its own scope (managers: everyone, employees: themselves). */}
        <Route path="tasks" element={<TasksPage />} />
        {/* Deadlines and bugs are filters on the Tasks page now; old links still work. */}
        <Route path="deadlines" element={<Navigate to="/app/tasks?view=deadlines" replace />} />
        <Route path="bugs" element={<OldBugsLink />} />
        <Route path="bugs/:bugId" element={<OldBugsLink />} />
        {/* Each page needs a permission from the person's role (see Settings → Roles). */}
        {/* Team shows workload ('members.view') and sign-ups waiting for approval ('members.approve'). */}
        <Route element={<RequirePermission anyOf={['members.view', 'members.approve']} />}>
          <Route path="team" element={<TeamPage />} />
        </Route>
        <Route path="approvals" element={<Navigate to="/app/team" replace />} />
        <Route element={<RequirePermission anyOf={SETTINGS_PERMISSIONS} />}>
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  )
}

// /app/bugs?project=… and /app/bugs/<id> → the Tasks page's Bugs filter (with the bug's drawer open).
function OldBugsLink() {
  const { bugId } = useParams()
  const { search } = useLocation()
  const next = new URLSearchParams(search)
  next.set('view', 'bugs')
  if (bugId) next.set('bug', bugId)
  return <Navigate to={`/app/tasks?${next.toString()}`} replace />
}
