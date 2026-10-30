import type { Session, WorkItem } from '../types'

// What the logged-in person may do with one task. The backend enforces the same rules.
// - full:   edit everything and delete (managers, or the employee who created the task)
// - status: only change the status (an employee's task that a manager created)
// - view:   look only (a teammate's task in a shared project)
export type TaskAccess = 'full' | 'status' | 'view'

export function taskAccess(item: WorkItem | null, session: Session | null, isManager: boolean): TaskAccess {
  if (!item || isManager) return 'full'
  const userId = session?.user.id
  if (item.createdById === userId) return 'full'
  if (item.assigneeId === userId) return 'status'
  return 'view'
}
