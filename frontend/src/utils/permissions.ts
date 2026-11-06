import type { Permission, Session, WorkItem } from '../types'

// What the logged-in person may do with one task. The backend enforces the same rules.
// - full:   edit everything and delete (roles with 'tasks.manage_all', or whoever created the task)
// - status: only change the status (a task assigned to you that someone else created)
// - view:   look only (a teammate's task in a shared project)
export type TaskAccess = 'full' | 'status' | 'view'

export function taskAccess(item: WorkItem | null, session: Session | null, managesAllTasks: boolean): TaskAccess {
  if (!item || managesAllTasks) return 'full'
  const userId = session?.user.id
  if (item.createdById === userId) return 'full'
  if (item.assigneeId === userId) return 'status'
  return 'view'
}

// Any of these lets someone open Workspace Settings (each tab checks its own permission).
export const SETTINGS_PERMISSIONS: Permission[] = [
  'organization.update',
  'statuses.manage',
  'fields.manage',
  'members.create',
  'members.update_role',
  'members.remove',
  'roles.manage',
]
