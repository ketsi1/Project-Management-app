import { query } from '../db/pool.js'
import { toProject } from '../db/mappers.js'
import { Events } from '../realtime/events.js'
import { broadcastToOrg } from '../realtime/socket.js'
import { ApiError } from '../utils/ApiError.js'
import { newId } from '../utils/time.js'
import { isManager, visibleProjectsFilter } from './visibility.js'

async function findProject(organizationId, id) {
  const rows = await query('SELECT * FROM projects WHERE id = ? AND organization_id = ?', [id, organizationId])
  if (rows.length === 0) throw ApiError.notFound('Project not found.')
  return toProject(rows[0])
}

// Managers see every project; employees only those with a work item assigned to them.
export async function listProjects(auth) {
  const filter = isManager(auth) ? null : visibleProjectsFilter(auth, 'p.id')
  const rows = await query(
    `SELECT p.* FROM projects p
      WHERE p.organization_id = ?${filter ? ` AND ${filter.sql}` : ''}
      ORDER BY p.created_at ASC, p.name ASC`,
    [auth.organizationId, ...(filter?.params ?? [])],
  )
  return rows.map(toProject)
}

export async function createProject(organizationId, { name, description }) {
  const id = newId()
  await query('INSERT INTO projects (id, organization_id, name, description) VALUES (?, ?, ?, ?)', [
    id,
    organizationId,
    name,
    description,
  ])
  broadcastToOrg(organizationId, Events.PROJECTS_CHANGED, { action: 'created', id })
  return findProject(organizationId, id)
}

export async function updateProject(organizationId, id, { name, description }) {
  const result = await query('UPDATE projects SET name = ?, description = ? WHERE id = ? AND organization_id = ?', [
    name,
    description,
    id,
    organizationId,
  ])
  if (result.affectedRows === 0) throw ApiError.notFound('Project not found.')
  broadcastToOrg(organizationId, Events.PROJECTS_CHANGED, { action: 'updated', id })
  return findProject(organizationId, id)
}

// Work items go with the project (ON DELETE CASCADE).
export async function deleteProject(organizationId, id) {
  const result = await query('DELETE FROM projects WHERE id = ? AND organization_id = ?', [id, organizationId])
  if (result.affectedRows === 0) throw ApiError.notFound('Project not found.')
  broadcastToOrg(organizationId, Events.PROJECTS_CHANGED, { action: 'deleted', id })
  broadcastToOrg(organizationId, Events.WORK_ITEMS_CHANGED, { action: 'deleted', projectId: id })
}
