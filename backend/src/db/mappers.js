// Turn database rows (snake_case) into the JSON shapes in pm-frontend/src/types.ts.
import { toIso } from '../utils/time.js'

function parseJson(value, fallback) {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return fallback
    }
  }
  return value
}

export const toOrganization = (row) => ({ id: row.id, name: row.name })

export const toTerminology = (row) => ({
  project: row.term_project,
  projects: row.term_projects,
  task: row.term_task,
  tasks: row.term_tasks,
})

export const toStatus = (row) => ({
  id: row.id,
  name: row.name,
  category: row.category,
  color: row.color,
  position: row.position,
})

export const toField = (row) => ({
  id: row.id,
  label: row.label,
  type: row.type,
  options: parseJson(row.options, []),
})

export const toMember = (row) => ({
  id: row.id,
  fullName: row.full_name,
  email: row.email,
  role: row.role,
})

export const toProject = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description ?? '',
  createdAt: toIso(row.created_at),
})

export const toWorkItem = (row) => ({
  id: row.id,
  projectId: row.project_id,
  title: row.title,
  description: row.description ?? '',
  statusId: row.status_id,
  priority: row.priority,
  assigneeId: row.assignee_id,
  dueDate: row.due_date,
  customValues: parseJson(row.custom_values, {}),
  createdById: row.created_by ?? null,
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at),
})
