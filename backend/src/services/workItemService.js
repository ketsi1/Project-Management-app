import { query } from '../db/pool.js'
import { toWorkItem } from '../db/mappers.js'
import { Events } from '../realtime/events.js'
import { broadcastToOrg } from '../realtime/socket.js'
import { ApiError } from '../utils/ApiError.js'
import { newId } from '../utils/time.js'
import { canSeeProject, isManager, visibleProjectsFilter } from './visibility.js'

async function findItem(organizationId, id) {
  const rows = await query('SELECT * FROM work_items WHERE id = ? AND organization_id = ?', [id, organizationId])
  return rows[0] ? toWorkItem(rows[0]) : null
}

// Finds an item the caller is allowed to see. Employees only see items in their projects,
// and get the same "not found" for items outside them, so nothing leaks.
async function findVisibleItem(auth, id) {
  const item = await findItem(auth.organizationId, id)
  if (!item) throw ApiError.notFound('Item not found.')
  if (!isManager(auth) && !(await canSeeProject(auth, item.projectId))) throw ApiError.notFound('Item not found.')
  return item
}

// Foreign keys only prove a row exists somewhere; these checks make sure the project,
// status and assignee belong to the caller's organization too.
async function assertReferences(organizationId, { projectId, statusId, assigneeId }) {
  const checks = []
  if (projectId !== undefined) {
    checks.push(
      query('SELECT 1 FROM projects WHERE id = ? AND organization_id = ?', [projectId, organizationId]).then((rows) => {
        if (rows.length === 0) throw ApiError.badRequest('Choose a valid project.')
      }),
    )
  }
  if (statusId !== undefined) {
    checks.push(
      query('SELECT 1 FROM statuses WHERE id = ? AND organization_id = ?', [statusId, organizationId]).then((rows) => {
        if (rows.length === 0) throw ApiError.badRequest('Choose a valid status.')
      }),
    )
  }
  if (assigneeId) {
    checks.push(
      query("SELECT 1 FROM organization_members WHERE user_id = ? AND organization_id = ? AND status = 'active'", [assigneeId, organizationId]).then(
        (rows) => {
          if (rows.length === 0) throw ApiError.badRequest('The assignee is not a member of this organization.')
        },
      ),
    )
  }
  await Promise.all(checks)
}

// Managers get every item. Employees get the items in projects where at least one
// item is assigned to them (so project progress still counts the whole project).
export async function listWorkItems(auth, projectId) {
  const conditions = ['w.organization_id = ?']
  const params = [auth.organizationId]

  if (projectId) {
    if (!isManager(auth) && !(await canSeeProject(auth, projectId))) throw ApiError.notFound('Project not found.')
    conditions.push('w.project_id = ?')
    params.push(projectId)
  }
  if (!isManager(auth)) {
    const filter = visibleProjectsFilter(auth, 'w.project_id')
    conditions.push(filter.sql)
    params.push(...filter.params)
  }

  const rows = await query(`SELECT w.* FROM work_items w WHERE ${conditions.join(' AND ')} ORDER BY w.created_at ASC`, params)
  return rows.map(toWorkItem)
}

export async function createWorkItem(auth, input) {
  const { organizationId } = auth
  await assertReferences(organizationId, input)
  // Employees can only add work to projects they can see.
  if (!isManager(auth) && !(await canSeeProject(auth, input.projectId))) throw ApiError.badRequest('Choose a valid project.')

  const id = newId()
  await query(
    `INSERT INTO work_items
       (id, organization_id, project_id, title, description, status_id, priority, assignee_id, due_date, custom_values, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      organizationId,
      input.projectId,
      input.title,
      input.description,
      input.statusId,
      input.priority,
      input.assigneeId,
      input.dueDate,
      JSON.stringify(input.customValues),
      auth.userId,
    ],
  )
  const item = await findItem(organizationId, id)
  broadcastToOrg(organizationId, Events.WORK_ITEMS_CHANGED, { action: 'created', id, projectId: item.projectId })
  return item
}

// Column names for each field PATCH may change.
const COLUMNS = {
  projectId: 'project_id',
  title: 'title',
  description: 'description',
  statusId: 'status_id',
  priority: 'priority',
  assigneeId: 'assignee_id',
  dueDate: 'due_date',
  customValues: 'custom_values',
}

const sameValue = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

// Employees can fully edit items they created. On anyone else's item they may only
// change the status, and only when the item is assigned to them.
async function assertCanUpdate(auth, item, changes) {
  if (isManager(auth) || item.createdById === auth.userId) {
    if (!isManager(auth) && changes.projectId !== undefined && !(await canSeeProject(auth, changes.projectId))) {
      throw ApiError.badRequest('Choose a valid project.')
    }
    return
  }
  // Fields sent with their current value are not real changes (forms often send everything).
  const changed = Object.keys(changes).filter((key) => key in COLUMNS && !sameValue(changes[key], item[key]))
  if (item.assigneeId !== auth.userId) throw ApiError.forbidden('You can only update tasks assigned to you.')
  if (changed.some((key) => key !== 'statusId')) {
    throw ApiError.forbidden('You can only change the status of a task a manager created.')
  }
}

export async function updateWorkItem(auth, id, changes) {
  const { organizationId } = auth
  const before = await findVisibleItem(auth, id)
  await assertCanUpdate(auth, before, changes)
  await assertReferences(organizationId, changes)

  const entries = Object.entries(changes).filter(([key]) => key in COLUMNS)
  const assignments = entries.map(([key]) => `${COLUMNS[key]} = ?`)
  const values = entries.map(([key, value]) => (key === 'customValues' ? JSON.stringify(value) : value))

  // Always bump updated_at, even when the values sent equal the stored ones.
  await query(
    `UPDATE work_items SET ${[...assignments, 'updated_at = CURRENT_TIMESTAMP'].join(', ')} WHERE id = ? AND organization_id = ?`,
    [...values, id, organizationId],
  )

  const item = await findItem(organizationId, id)
  broadcastToOrg(organizationId, Events.WORK_ITEMS_CHANGED, { action: 'updated', id, projectId: item.projectId })
  if (before.projectId !== item.projectId) {
    broadcastToOrg(organizationId, Events.WORK_ITEMS_CHANGED, { action: 'moved', id, projectId: before.projectId })
  }
  return item
}

// Employees can only delete items they created themselves.
export async function deleteWorkItem(auth, id) {
  const { organizationId } = auth
  const item = await findItem(organizationId, id)
  if (!item) throw ApiError.notFound('Item not found.')
  if (!isManager(auth) && item.createdById !== auth.userId) {
    throw ApiError.forbidden('Only a manager can delete this task. You can change its status instead.')
  }
  await query('DELETE FROM work_items WHERE id = ? AND organization_id = ?', [id, organizationId])
  broadcastToOrg(organizationId, Events.WORK_ITEMS_CHANGED, { action: 'deleted', id, projectId: item.projectId })
}
