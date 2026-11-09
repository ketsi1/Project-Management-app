// Who can see which projects. Roles with 'projects.view_all' see everything. Everyone else only
// sees a project when at least one of its work items is assigned to them.
import type { AuthContext } from '../auth/sessionStore.ts'
import { prisma, type Prisma } from '../db/prisma.ts'
import { can } from '../middleware/auth.ts'

export const seesAllProjects = (auth: AuthContext): boolean => can(auth, 'projects.view_all')
// Edit and delete any task, not only ones you created.
export const managesAllTasks = (auth: AuthContext): boolean => can(auth, 'tasks.manage_all')

// Prisma filter for a Project the caller can see (without 'projects.view_all').
export const visibleProjectWhere = (auth: AuthContext): Prisma.ProjectWhereInput => ({
  workItems: { some: { assigneeId: auth.userId } },
})

export async function canSeeProject(auth: AuthContext, projectId: string): Promise<boolean> {
  if (seesAllProjects(auth)) return true
  const item = await prisma.workItem.findFirst({
    where: { organizationId: auth.organizationId, projectId, assigneeId: auth.userId },
    select: { id: true },
  })
  return item !== null
}
