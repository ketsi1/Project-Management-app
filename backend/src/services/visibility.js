// Who can see which projects. Managers (owner/admin) see everything. Employees only see a
// project when at least one of its work items is assigned to them.
import { query } from '../db/pool.js'

export const isManager = (auth) => auth.role === 'owner' || auth.role === 'admin'

// SQL condition limiting `column` (a project id column) to the employee's projects.
export function visibleProjectsFilter(auth, column) {
  return {
    sql: `${column} IN (SELECT a.project_id FROM work_items a WHERE a.organization_id = ? AND a.assignee_id = ?)`,
    params: [auth.organizationId, auth.userId],
  }
}

export async function canSeeProject(auth, projectId) {
  if (isManager(auth)) return true
  const rows = await query(
    'SELECT 1 FROM work_items WHERE organization_id = ? AND project_id = ? AND assignee_id = ? LIMIT 1',
    [auth.organizationId, projectId, auth.userId],
  )
  return rows.length > 0
}
