// The starter content every new organization gets (same as mockApi.ts seedOrganization).
import { query } from '../db/pool.js'
import { daysFromToday, newId } from '../utils/time.js'

const DEFAULT_STATUSES = [
  { name: 'To do', category: 'not_started', color: '#94a3b8' },
  { name: 'In progress', category: 'active', color: '#3b82f6' },
  { name: 'In review', category: 'active', color: '#f59e0b' },
  { name: 'Done', category: 'done', color: '#22c55e' },
]

const SAMPLE_ITEMS = [
  { title: 'Invite your team members', status: 0, priority: 'high', days: 2 },
  { title: 'Rename statuses to match your process', status: 1, priority: 'medium', days: 4 },
  { title: 'Add a custom field in Settings', status: 2, priority: 'low', days: 7 },
  { title: 'Create your account', status: 3, priority: 'low', days: -1 },
]

export async function createStarterContent(connection, { organizationId, ownerId }) {
  const statusIds = []
  for (const [position, status] of DEFAULT_STATUSES.entries()) {
    const id = newId()
    statusIds.push(id)
    await query(
      'INSERT INTO statuses (id, organization_id, name, category, color, position) VALUES (?, ?, ?, ?, ?, ?)',
      [id, organizationId, status.name, status.category, status.color, position],
      connection,
    )
  }

  const projectId = newId()
  await query(
    'INSERT INTO projects (id, organization_id, name, description) VALUES (?, ?, ?, ?)',
    [projectId, organizationId, 'Getting started', 'A sample project to explore the board.'],
    connection,
  )

  for (const item of SAMPLE_ITEMS) {
    await query(
      `INSERT INTO work_items
         (id, organization_id, project_id, title, description, status_id, priority, assignee_id, due_date, custom_values, created_by)
       VALUES (?, ?, ?, ?, '', ?, ?, ?, ?, '{}', ?)`,
      [newId(), organizationId, projectId, item.title, statusIds[item.status], item.priority, ownerId, daysFromToday(item.days), ownerId],
      connection,
    )
  }
}
