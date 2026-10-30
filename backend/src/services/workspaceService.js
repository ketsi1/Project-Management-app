import { query, transaction } from '../db/pool.js'
import { toField, toMember, toOrganization, toStatus, toTerminology } from '../db/mappers.js'
import { Events } from '../realtime/events.js'
import { broadcastToOrg } from '../realtime/socket.js'
import { ApiError } from '../utils/ApiError.js'
import { newId } from '../utils/time.js'

// --- Workspace ----------------------------------------------------------------

// Only approved members appear in 'members' (assignee lists, team views). Managers also get
// 'pendingMembers': sign-ups waiting for approval. Employees always get an empty list.
export async function getWorkspace(organizationId, { isManager = false } = {}) {
  const [orgRows, statusRows, fieldRows, memberRows] = await Promise.all([
    query('SELECT * FROM organizations WHERE id = ?', [organizationId]),
    query('SELECT * FROM statuses WHERE organization_id = ? ORDER BY position ASC, created_at ASC', [organizationId]),
    query('SELECT * FROM custom_fields WHERE organization_id = ? ORDER BY created_at ASC', [organizationId]),
    query(
      `SELECT u.id, u.full_name, u.email, m.role, m.status
         FROM organization_members m JOIN users u ON u.id = m.user_id
        WHERE m.organization_id = ? AND (m.status = 'active' OR ?)
        ORDER BY FIELD(m.role, 'owner', 'admin', 'member'), u.full_name ASC`,
      [organizationId, isManager],
    ),
  ])
  if (orgRows.length === 0) throw ApiError.notFound('Organization not found.')

  return {
    organization: toOrganization(orgRows[0]),
    terminology: toTerminology(orgRows[0]),
    statuses: statusRows.map(toStatus),
    fields: fieldRows.map(toField),
    members: memberRows.filter((r) => r.status === 'active').map(toMember),
    pendingMembers: memberRows.filter((r) => r.status === 'pending').map(toMember),
  }
}

export async function updateOrganization(organizationId, { name, terminology }) {
  await query(
    `UPDATE organizations
        SET name = ?, term_project = ?, term_projects = ?, term_task = ?, term_tasks = ?
      WHERE id = ?`,
    [name, terminology.project, terminology.projects, terminology.task, terminology.tasks, organizationId],
  )
  broadcastToOrg(organizationId, Events.WORKSPACE_CHANGED, { section: 'organization' })
}

// --- Statuses -----------------------------------------------------------------

async function findStatus(organizationId, id, connection) {
  const rows = await query('SELECT * FROM statuses WHERE id = ? AND organization_id = ?', [id, organizationId], connection)
  return rows[0] ?? null
}

export async function createStatus(organizationId, input) {
  const id = newId()
  await query(
    'INSERT INTO statuses (id, organization_id, name, category, color, position) VALUES (?, ?, ?, ?, ?, ?)',
    [id, organizationId, input.name, input.category, input.color, input.position],
  )
  broadcastToOrg(organizationId, Events.WORKSPACE_CHANGED, { section: 'statuses' })
  return toStatus(await findStatus(organizationId, id))
}

export async function updateStatus(organizationId, id, input) {
  const result = await query(
    'UPDATE statuses SET name = ?, category = ?, color = ?, position = ? WHERE id = ? AND organization_id = ?',
    [input.name, input.category, input.color, input.position, id, organizationId],
  )
  if (result.affectedRows === 0) throw ApiError.notFound('Status not found.')
  broadcastToOrg(organizationId, Events.WORKSPACE_CHANGED, { section: 'statuses' })
  return toStatus(await findStatus(organizationId, id))
}

// Moves every item in the status to `moveToStatusId`, then deletes the status.
export async function deleteStatus(organizationId, id, moveToStatusId) {
  await transaction(async (connection) => {
    // Lock this org's statuses so two deletes cannot leave it with none.
    const statuses = await query(
      'SELECT id FROM statuses WHERE organization_id = ? FOR UPDATE',
      [organizationId],
      connection,
    )
    if (!statuses.some((s) => s.id === id)) throw ApiError.notFound('Status not found.')
    if (statuses.length <= 1) throw ApiError.badRequest('You need at least one status.')
    if (moveToStatusId === id || !statuses.some((s) => s.id === moveToStatusId)) {
      throw ApiError.badRequest('Choose another status to move the items to.')
    }

    await query(
      'UPDATE work_items SET status_id = ? WHERE status_id = ? AND organization_id = ?',
      [moveToStatusId, id, organizationId],
      connection,
    )
    await query('DELETE FROM statuses WHERE id = ? AND organization_id = ?', [id, organizationId], connection)
  })
  broadcastToOrg(organizationId, Events.WORKSPACE_CHANGED, { section: 'statuses' })
  broadcastToOrg(organizationId, Events.WORK_ITEMS_CHANGED, { action: 'moved', fromStatusId: id, toStatusId: moveToStatusId })
}

// --- Custom fields ------------------------------------------------------------

export async function createField(organizationId, input) {
  const id = newId()
  await query(
    'INSERT INTO custom_fields (id, organization_id, label, type, options) VALUES (?, ?, ?, ?, ?)',
    [id, organizationId, input.label, input.type, JSON.stringify(input.options)],
  )
  broadcastToOrg(organizationId, Events.WORKSPACE_CHANGED, { section: 'fields' })
  return { id, label: input.label, type: input.type, options: input.options }
}

export async function deleteField(organizationId, id) {
  await transaction(async (connection) => {
    const result = await query('DELETE FROM custom_fields WHERE id = ? AND organization_id = ?', [id, organizationId], connection)
    if (result.affectedRows === 0) throw ApiError.notFound('Field not found.')
    // Drop the field's values from every item so no orphaned data is left behind.
    await query(
      `UPDATE work_items SET custom_values = JSON_REMOVE(custom_values, CONCAT('$."', ?, '"'))
        WHERE organization_id = ? AND JSON_CONTAINS_PATH(custom_values, 'one', CONCAT('$."', ?, '"'))`,
      [id, organizationId, id],
      connection,
    )
  })
  broadcastToOrg(organizationId, Events.WORKSPACE_CHANGED, { section: 'fields' })
}
