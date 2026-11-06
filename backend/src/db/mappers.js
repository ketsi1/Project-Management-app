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
  roleId: row.role_id,
  roleName: row.role_name,
  // false while an invited person has not chosen a password yet
  activated: row.activated === undefined ? true : !!row.activated,
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

export const toBug = (row) => ({
  id: row.id,
  number: row.number,
  key: `BUG-${row.number}`,
  projectId: row.project_id,
  workItemId: row.work_item_id ?? null,
  title: row.title,
  description: row.description ?? '',
  stepsToReproduce: row.steps_to_reproduce ?? '',
  expectedResult: row.expected_result ?? '',
  actualResult: row.actual_result ?? '',
  environment: row.environment ?? '',
  severity: row.severity,
  priority: row.priority,
  status: row.status,
  resolution: row.resolution ?? null,
  reporterId: row.reporter_id ?? null,
  assigneeId: row.assignee_id ?? null,
  commentCount: Number(row.comment_count ?? 0),
  resolvedAt: toIso(row.resolved_at),
  closedAt: toIso(row.closed_at),
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at),
})

export const toBugComment = (row) => ({
  id: row.id,
  kind: row.kind,
  authorId: row.author_id ?? null,
  authorName: row.author_name ?? null,
  body: row.body,
  createdAt: toIso(row.created_at),
})
