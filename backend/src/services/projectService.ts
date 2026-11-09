import type { AuthContext } from '../auth/sessionStore.ts'
import { prisma } from '../db/prisma.ts'
import { toProject, type ProjectDto } from '../db/mappers.ts'
import { Events } from '../realtime/events.ts'
import { broadcastToOrg } from '../realtime/socket.ts'
import { ApiError } from '../utils/ApiError.ts'
import { newId } from '../utils/time.ts'
import type { ProjectInput } from '../validation/schemas.ts'
import { seesAllProjects, visibleProjectWhere } from './visibility.ts'

// Roles with 'projects.view_all' see every project; everyone else only those with a work item assigned to them.
export async function listProjects(auth: AuthContext): Promise<ProjectDto[]> {
  const projects = await prisma.project.findMany({
    where: { organizationId: auth.organizationId, ...(seesAllProjects(auth) ? {} : visibleProjectWhere(auth)) },
    orderBy: [{ createdAt: 'asc' }, { name: 'asc' }],
  })
  return projects.map(toProject)
}

export async function createProject(organizationId: string, { name, description }: ProjectInput): Promise<ProjectDto> {
  const project = await prisma.project.create({ data: { id: newId(), organizationId, name, description } })
  broadcastToOrg(organizationId, Events.PROJECTS_CHANGED, { action: 'created', id: project.id })
  return toProject(project)
}

export async function updateProject(organizationId: string, id: string, { name, description }: ProjectInput): Promise<ProjectDto> {
  const { count } = await prisma.project.updateMany({ where: { id, organizationId }, data: { name, description } })
  if (count === 0) throw ApiError.notFound('Project not found.')
  broadcastToOrg(organizationId, Events.PROJECTS_CHANGED, { action: 'updated', id })
  return toProject(await prisma.project.findUniqueOrThrow({ where: { id } }))
}

// Work items and bugs go with the project (ON DELETE CASCADE).
export async function deleteProject(organizationId: string, id: string): Promise<void> {
  const { count } = await prisma.project.deleteMany({ where: { id, organizationId } })
  if (count === 0) throw ApiError.notFound('Project not found.')
  broadcastToOrg(organizationId, Events.PROJECTS_CHANGED, { action: 'deleted', id })
  broadcastToOrg(organizationId, Events.WORK_ITEMS_CHANGED, { action: 'deleted', projectId: id })
}
