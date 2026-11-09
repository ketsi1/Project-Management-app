import type { AuthContext } from '../auth/sessionStore.ts'
import { prisma, type Prisma } from '../db/prisma.ts'
import { toWorkItem, type WorkItemDto } from '../db/mappers.ts'
import { Events } from '../realtime/events.ts'
import { broadcastToOrg } from '../realtime/socket.ts'
import { ApiError } from '../utils/ApiError.ts'
import { fromDateOnly, newId } from '../utils/time.ts'
import type { CreateWorkItemInput, UpdateWorkItemInput } from '../validation/schemas.ts'
import { canSeeProject, managesAllTasks, seesAllProjects, visibleProjectWhere } from './visibility.ts'

async function findItem(organizationId: string, id: string): Promise<WorkItemDto | null> {
  const item = await prisma.workItem.findFirst({ where: { id, organizationId } })
  return item ? toWorkItem(item) : null
}

// Finds an item the caller is allowed to see. People who don't see every project get the same
// "not found" for items outside their projects, so nothing leaks.
async function findVisibleItem(auth: AuthContext, id: string): Promise<WorkItemDto> {
  const item = await findItem(auth.organizationId, id)
  if (!item) throw ApiError.notFound('Item not found.')
  if (!seesAllProjects(auth) && !(await canSeeProject(auth, item.projectId))) throw ApiError.notFound('Item not found.')
  return item
}

interface WorkItemReferences {
  projectId?: string | undefined
  statusId?: string | undefined
  assigneeId?: string | null | undefined
}

// Foreign keys only prove a row exists somewhere; these checks make sure the project,
// status and assignee belong to the caller's organization too.
async function assertReferences(organizationId: string, { projectId, statusId, assigneeId }: WorkItemReferences): Promise<void> {
  const checks: Promise<void>[] = []
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

// Request fields → Prisma data for an update (due dates arrive as 'YYYY-MM-DD').
// Only fields that were sent are included.
function toUpdateData(input: UpdateWorkItemInput): Prisma.WorkItemUncheckedUpdateInput {
  const data: Prisma.WorkItemUncheckedUpdateInput = {}
  if (input.projectId !== undefined) data.projectId = input.projectId
  if (input.title !== undefined) data.title = input.title
  if (input.description !== undefined) data.description = input.description
  if (input.statusId !== undefined) data.statusId = input.statusId
  if (input.priority !== undefined) data.priority = input.priority
  if (input.assigneeId !== undefined) data.assigneeId = input.assigneeId
  if (input.customValues !== undefined) data.customValues = input.customValues
  if (input.dueDate !== undefined) data.dueDate = fromDateOnly(input.dueDate)
  return data
}

// Roles that see all projects get every item. Everyone else gets the items in projects where
// at least one item is assigned to them (so project progress still counts the whole project).
export async function listWorkItems(auth: AuthContext, projectId: string | undefined): Promise<WorkItemDto[]> {
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

export async function createWorkItem(auth: AuthContext, input: CreateWorkItemInput): Promise<WorkItemDto> {
  const { organizationId } = auth
  await assertReferences(organizationId, input)
  // People who don't see every project can only add work to projects they can see.
  if (!seesAllProjects(auth) && !(await canSeeProject(auth, input.projectId))) throw ApiError.badRequest('Choose a valid project.')

  const created = await prisma.workItem.create({
    data: {
      id: newId(),
      organizationId,
      createdById: auth.userId,
      projectId: input.projectId,
      title: input.title,
      description: input.description,
      statusId: input.statusId,
      priority: input.priority,
      assigneeId: input.assigneeId,
      dueDate: fromDateOnly(input.dueDate),
      customValues: input.customValues,
    },
  })
  const item = toWorkItem(created)
  broadcastToOrg(organizationId, Events.WORK_ITEMS_CHANGED, { action: 'created', id: item.id, projectId: item.projectId })
  return item
}

const EDITABLE = ['projectId', 'title', 'description', 'statusId', 'priority', 'assigneeId', 'dueDate', 'customValues'] as const
type EditableField = (typeof EDITABLE)[number]
const isEditable = (key: string): key is EditableField => (EDITABLE as readonly string[]).includes(key)
const sameValue = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

// Without 'tasks.manage_all', people can fully edit items they created. On anyone else's item
// they may only change the status, and only when the item is assigned to them.
async function assertCanUpdate(auth: AuthContext, item: WorkItemDto, changes: UpdateWorkItemInput): Promise<void> {
  if (managesAllTasks(auth) || item.createdById === auth.userId) {
    if (!seesAllProjects(auth) && changes.projectId !== undefined && !(await canSeeProject(auth, changes.projectId))) {
      throw ApiError.badRequest('Choose a valid project.')
    }
    return
  }
  // Fields sent with their current value are not real changes (forms often send everything).
  const changed = Object.keys(changes)
    .filter(isEditable)
    .filter((key) => !sameValue(changes[key], item[key]))
  if (item.assigneeId !== auth.userId) throw ApiError.forbidden('You can only update tasks assigned to you.')
  if (changed.some((key) => key !== 'statusId')) {
    throw ApiError.forbidden('You can only change the status of a task someone else created.')
  }
}

export async function updateWorkItem(auth: AuthContext, id: string, changes: UpdateWorkItemInput): Promise<WorkItemDto> {
  const { organizationId } = auth
  const before = await findVisibleItem(auth, id)
  await assertCanUpdate(auth, before, changes)
  await assertReferences(organizationId, changes)

  // updatedAt is bumped by Prisma even when the values sent equal the stored ones.
  const item = toWorkItem(await prisma.workItem.update({ where: { id }, data: { ...toUpdateData(changes), updatedAt: new Date() } }))
  broadcastToOrg(organizationId, Events.WORK_ITEMS_CHANGED, { action: 'updated', id, projectId: item.projectId })
  if (before.projectId !== item.projectId) {
    broadcastToOrg(organizationId, Events.WORK_ITEMS_CHANGED, { action: 'moved', id, projectId: before.projectId })
  }
  return item
}

// Without 'tasks.manage_all', people can only delete items they created themselves.
export async function deleteWorkItem(auth: AuthContext, id: string): Promise<void> {
  const { organizationId } = auth
  const item = await findItem(organizationId, id)
  if (!item) throw ApiError.notFound('Item not found.')
  if (!managesAllTasks(auth) && item.createdById !== auth.userId) {
    throw ApiError.forbidden('Your role can only delete tasks you created. You can change its status instead.')
  }
  await prisma.workItem.delete({ where: { id } })
  broadcastToOrg(organizationId, Events.WORK_ITEMS_CHANGED, { action: 'deleted', id, projectId: item.projectId })
}
