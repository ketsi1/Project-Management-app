import { prisma } from '../db/prisma.js'
import { toProject } from '../db/mappers.js'
import { Events } from '../realtime/events.js'
import { broadcastToOrg } from '../realtime/socket.js'
import { ApiError } from '../utils/ApiError.js'
import { newId } from '../utils/time.js'
import { seesAllProjects, visibleProjectWhere } from './visibility.js'

// Roles with 'projects.view_all' see every project; everyone else only those with a work item assigned to them.
export async function listProjects(auth) {
  const projects = await prisma.project.findMany({
    where: { organizationId: auth.organizationId, ...(seesAllProjects(auth) ? {} : visibleProjectWhere(auth)) },
    orderBy: [{ createdAt: 'asc' }, { name: 'asc' }],
  })
  return projects.map(toProject)
}

export async function createProject(organizationId, { name, description }) {
  const project = await prisma.project.create({ data: { id: newId(), organizationId, name, description } })
  broadcastToOrg(organizationId, Events.PROJECTS_CHANGED, { action: 'created', id: project.id })
  return toProject(project)
}

export async function updateProject(organizationId, id, { name, description }) {
  const { count } = await prisma.project.updateMany({ where: { id, organizationId }, data: { name, description } })
  if (count === 0) throw ApiError.notFound('Project not found.')
  broadcastToOrg(organizationId, Events.PROJECTS_CHANGED, { action: 'updated', id })
  return toProject(await prisma.project.findUnique({ where: { id } }))
}

// Work items and bugs go with the project (ON DELETE CASCADE).
export async function deleteProject(organizationId, id) {
  const { count } = await prisma.project.deleteMany({ where: { id, organizationId } })
  if (count === 0) throw ApiError.notFound('Project not found.')
  broadcastToOrg(organizationId, Events.PROJECTS_CHANGED, { action: 'deleted', id })
  broadcastToOrg(organizationId, Events.WORK_ITEMS_CHANGED, { action: 'deleted', projectId: id })
}
