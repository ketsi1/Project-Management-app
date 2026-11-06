// Who can see which projects. Roles with 'projects.view_all' see everything. Everyone else only
// sees a project when at least one of its work items is assigned to them.
import { prisma } from '../db/prisma.js'
import { can } from '../middleware/auth.js'

export const seesAllProjects = (auth) => can(auth, 'projects.view_all')
// Edit and delete any task, not only ones you created.
export const managesAllTasks = (auth) => can(auth, 'tasks.manage_all')

// Prisma filter for a Project the caller can see (without 'projects.view_all').
export const visibleProjectWhere = (auth) => ({ workItems: { some: { assigneeId: auth.userId } } })

export async function canSeeProject(auth, projectId) {
  if (seesAllProjects(auth)) return true
  const item = await prisma.workItem.findFirst({
    where: { organizationId: auth.organizationId, projectId, assigneeId: auth.userId },
    select: { id: true },
  })
  return item !== null
}
