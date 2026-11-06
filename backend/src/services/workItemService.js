import { prisma } from '../db/prisma.js'
import { toWorkItem } from '../db/mappers.js'
import { Events } from '../realtime/events.js'
import { broadcastToOrg } from '../realtime/socket.js'
import { ApiError } from '../utils/ApiError.js'
import { fromDateOnly, newId } from '../utils/time.js'
import { canSeeProject, managesAllTasks, seesAllProjects, visibleProjectWhere } from './visibility.js'

async function findItem(organizationId, id) {
  const item = await prisma.workItem.findFirst({ where: { id, organizationId } })
  return item ? toWorkItem(item) : null
}

// Finds an item the caller is allowed to see. People who don't see every project get the same
// "not found" for items outside their projects, so nothing leaks.
async function findVisibleItem(auth, id) {
  const item = await findItem(auth.organizationId, id)
  if (!item) throw ApiError.notFound('Item not found.')
  if (!seesAllProjects(auth) && !(await canSeeProject(auth, item.projectId))) throw ApiError.notFound('Item not found.')
  return item
}

// Foreign keys only prove a row exists somewhere; these checks make sure the project,
// status and assignee belong to the caller's organization too.
async function assertReferences(organizationId, { projectId, statusId, assigneeId }) {
  const checks = []
  if (projectId !== undefined) {
    checks.push(
      prisma.project.findFirst({ where: { id: projectId, organizationId }, select: { id: true } }).then((found) => {
        if (!found) throw ApiError.badRequest('Choose a valid project.')
      }),
    )
  }
  if (statusId !== undefined) {
    checks.push(
      prisma.status.findFirst({ where: { id: statusId, organizationId }, select: { id: true } }).then((found) => {
        if (!found) throw ApiError.badRequest('Choose a valid status.')
      }),
    )
  }
  if (assigneeId) {
    checks.push(
      prisma.organizationMember.findFirst({ where: { userId: assigneeId, organizationId, status: 'active' }, select: { id: true } }).then((found) => {
        if (!found) throw ApiError.badRequest('The assignee is not a member of this organization.')
      }),
    )
  }
  await Promise.all(checks)
}

// Request fields → Prisma data (due dates arrive as 'YYYY-MM-DD').
function toData(input) {
  const data = {}
  for (const key of ['projectId', 'title', 'description', 'statusId', 'priority', 'assigneeId', 'customValues']) {
    if (input[key] !== undefined) data[key] = input[key]
  }
  if (input.dueDate !== undefined) data.dueDate = fromDateOnly(input.dueDate)
  return data
}

// Roles that see all projects get every item. Everyone else gets the items in projects where
// at least one item is assigned to them (so project progress still counts the whole project).
export async function listWorkItems(auth, projectId) {
  if (projectId && !seesAllProjects(auth) && !(await canSeeProject(auth, projectId))) throw ApiError.notFound('Project not found.')
  const items = await prisma.workItem.findMany({
    where: {
      organizationId: auth.organizationId,
      ...(projectId ? { projectId } : {}),
      ...(seesAllProjects(auth) ? {} : { project: visibleProjectWhere(auth) }),
    },
    orderBy: { createdAt: 'asc' },
  })
  return items.map(toWorkItem)
}

export async function createWorkItem(auth, input) {
  const { organizationId } = auth
  await assertReferences(organizationId, input)
  // People who don't see every project can only add work to projects they can see.
  if (!seesAllProjects(auth) && !(await canSeeProject(auth, input.projectId))) throw ApiError.badRequest('Choose a valid project.')

  const created = await prisma.workItem.create({
    data: { id: newId(), organizationId, createdById: auth.userId, ...toData(input) },
  })
  const item = toWorkItem(created)
  broadcastToOrg(organizationId, Events.WORK_ITEMS_CHANGED, { action: 'created', id: item.id, projectId: item.projectId })
  return item
}

const EDITABLE = ['projectId', 'title', 'description', 'statusId', 'priority', 'assigneeId', 'dueDate', 'customValues']
const sameValue = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

// Without 'tasks.manage_all', people can fully edit items they created. On anyone else's item
// they may only change the status, and only when the item is assigned to them.
async function assertCanUpdate(auth, item, changes) {
  if (managesAllTasks(auth) || item.createdById === auth.userId) {
    if (!seesAllProjects(auth) && changes.projectId !== undefined && !(await canSeeProject(auth, changes.projectId))) {
      throw ApiError.badRequest('Choose a valid project.')
    }
    return
  }
  // Fields sent with their current value are not real changes (forms often send everything).
  const changed = Object.keys(changes).filter((key) => EDITABLE.includes(key) && !sameValue(changes[key], item[key]))
  if (item.assigneeId !== auth.userId) throw ApiError.forbidden('You can only update tasks assigned to you.')
  if (changed.some((key) => key !== 'statusId')) {
    throw ApiError.forbidden('You can only change the status of a task someone else created.')
  }
}

export async function updateWorkItem(auth, id, changes) {
  const { organizationId } = auth
  const before = await findVisibleItem(auth, id)
  await assertCanUpdate(auth, before, changes)
  await assertReferences(organizationId, changes)

  // updatedAt is bumped by Prisma even when the values sent equal the stored ones.
  const item = toWorkItem(await prisma.workItem.update({ where: { id }, data: { ...toData(changes), updatedAt: new Date() } }))
  broadcastToOrg(organizationId, Events.WORK_ITEMS_CHANGED, { action: 'updated', id, projectId: item.projectId })
  if (before.projectId !== item.projectId) {
    broadcastToOrg(organizationId, Events.WORK_ITEMS_CHANGED, { action: 'moved', id, projectId: before.projectId })
  }
  return item
}

// Without 'tasks.manage_all', people can only delete items they created themselves.
export async function deleteWorkItem(auth, id) {
  const { organizationId } = auth
  const item = await findItem(organizationId, id)
  if (!item) throw ApiError.notFound('Item not found.')
  if (!managesAllTasks(auth) && item.createdById !== auth.userId) {
    throw ApiError.forbidden('Your role can only delete tasks you created. You can change its status instead.')
  }
  await prisma.workItem.delete({ where: { id } })
  broadcastToOrg(organizationId, Events.WORK_ITEMS_CHANGED, { action: 'deleted', id, projectId: item.projectId })
}
