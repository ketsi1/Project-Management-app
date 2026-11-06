// Who can see which projects. Roles with 'projects.view_all' see everything. Everyone else only
// sees a project when at least one of its work items is assigned to them.
import { query } from '../db/pool.js'
import { can } from '../middleware/auth.js'

export const seesAllProjects = (auth) => can(auth, 'projects.view_all')
// Edit and delete any task, not only ones you created.
export const managesAllTasks = (auth) => can(auth, 'tasks.manage_all')

// SQL condition limiting `column` (a project id column) to the employee's projects.
export function visibleProjectsFilter(auth, column) {
  return {
    sql: `${column} IN (SELECT a.project_id FROM work_items a WHERE a.organization_id = ? AND a.assignee_id = ?)`,
    params: [auth.organizationId, auth.userId],
  }
}

export async function canSeeProject(auth, projectId) {
  if (seesAllProjects(auth)) return true
  const rows = await query(
    'SELECT 1 FROM work_items WHERE organization_id = ? AND project_id = ? AND assignee_id = ? LIMIT 1',
    [auth.organizationId, projectId, auth.userId],
  )
  return rows.length > 0
}
