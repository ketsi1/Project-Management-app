import { Prisma, prisma } from '../db/prisma.ts'
import { memberInclude, toField, toMember, toOrganization, toStatus, toTerminology, type FieldDto, type StatusDto } from '../db/mappers.ts'
import { Events } from '../realtime/events.ts'
import { broadcastToOrg } from '../realtime/socket.ts'
import { ApiError } from '../utils/ApiError.ts'
import { newId } from '../utils/time.ts'
import type { FieldInput, StatusInput, UpdateOrganizationInput } from '../validation/schemas.ts'

const ROLE_ORDER = ['owner', 'admin', 'manager', 'member']
const roleRank = (slug: string): number => (ROLE_ORDER.includes(slug) ? ROLE_ORDER.indexOf(slug) : ROLE_ORDER.length)

// --- Workspace ----------------------------------------------------------------

// Only approved members appear in 'members' (assignee lists, team views). People who can approve
// sign-ups also get 'pendingMembers'; everyone else gets an empty list.
// 'roles' lists the organization's roles (name only) for pickers and labels.
export async function getWorkspace(organizationId: string, { includePending = false } = {}) {
  const [org, statuses, fields, members, roles] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId } }),
    prisma.status.findMany({ where: { organizationId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
    prisma.customField.findMany({ where: { organizationId }, orderBy: { createdAt: 'asc' } }),
    prisma.organizationMember.findMany({
      where: { organizationId, status: includePending ? { in: ['active', 'pending'] } : 'active' },
      include: memberInclude,
    }),
    prisma.role.findMany({ where: { organizationId }, select: { id: true, slug: true, name: true }, orderBy: { name: 'asc' } }),
  ])
  if (!org) throw ApiError.notFound('Organization not found.')

  members.sort((a, b) => roleRank(a.role.slug) - roleRank(b.role.slug) || a.user.fullName.localeCompare(b.user.fullName))
  return {
    organization: toOrganization(org),
    terminology: toTerminology(org),
    statuses: statuses.map(toStatus),
    fields: fields.map(toField),
    members: members.filter((m) => m.status === 'active').map(toMember),
    pendingMembers: members.filter((m) => m.status === 'pending').map(toMember),
    roles: roles.sort((a, b) => roleRank(a.slug) - roleRank(b.slug)),
  }
}

export async function updateOrganization(organizationId: string, { name, terminology }: UpdateOrganizationInput): Promise<void> {
  await prisma.organization.update({
    where: { id: organizationId },
    data: { name, termProject: terminology.project, termProjects: terminology.projects, termTask: terminology.task, termTasks: terminology.tasks },
  })
  broadcastToOrg(organizationId, Events.WORKSPACE_CHANGED, { section: 'organization' })
}

// --- Statuses -----------------------------------------------------------------

export async function createStatus(organizationId: string, input: StatusInput): Promise<StatusDto> {
  const status = await prisma.status.create({ data: { id: newId(), organizationId, ...input } })
  broadcastToOrg(organizationId, Events.WORKSPACE_CHANGED, { section: 'statuses' })
  return toStatus(status)
}

export async function updateStatus(organizationId: string, id: string, input: StatusInput): Promise<StatusDto> {
  const { count } = await prisma.status.updateMany({ where: { id, organizationId }, data: input })
  if (count === 0) throw ApiError.notFound('Status not found.')
  broadcastToOrg(organizationId, Events.WORKSPACE_CHANGED, { section: 'statuses' })
  return toStatus(await prisma.status.findUniqueOrThrow({ where: { id } }))
}

// Moves every item in the status to `moveToStatusId`, then deletes the status.
export async function deleteStatus(organizationId: string, id: string, moveToStatusId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Lock this org's statuses so two deletes cannot leave it with none.
    const statuses = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM statuses WHERE organization_id = ${organizationId} FOR UPDATE`
    if (!statuses.some((s) => s.id === id)) throw ApiError.notFound('Status not found.')
    if (statuses.length <= 1) throw ApiError.badRequest('You need at least one status.')
    if (moveToStatusId === id || !statuses.some((s) => s.id === moveToStatusId)) {
      throw ApiError.badRequest('Choose another status to move the items to.')
    }
    await tx.workItem.updateMany({ where: { statusId: id, organizationId }, data: { statusId: moveToStatusId } })
    await tx.status.delete({ where: { id } })
  })
  broadcastToOrg(organizationId, Events.WORKSPACE_CHANGED, { section: 'statuses' })
  broadcastToOrg(organizationId, Events.WORK_ITEMS_CHANGED, { action: 'moved', fromStatusId: id, toStatusId: moveToStatusId })
}

// --- Custom fields ------------------------------------------------------------

export async function createField(organizationId: string, input: FieldInput): Promise<FieldDto> {
  const field = await prisma.customField.create({ data: { id: newId(), organizationId, ...input } })
  broadcastToOrg(organizationId, Events.WORKSPACE_CHANGED, { section: 'fields' })
  return toField(field)
}

export async function deleteField(organizationId: string, id: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.customField.deleteMany({ where: { id, organizationId } })
    if (count === 0) throw ApiError.notFound('Field not found.')
    // Drop the field's values from every item so no orphaned data is left behind.
    // MySQL's JSON_REMOVE does this in one statement; Prisma has no JSON-key delete.
    const path = `$."${id}"`
    await tx.$executeRaw(
      Prisma.sql`UPDATE work_items SET custom_values = JSON_REMOVE(custom_values, ${path})
                  WHERE organization_id = ${organizationId} AND JSON_CONTAINS_PATH(custom_values, 'one', ${path})`,
    )
  })
  broadcastToOrg(organizationId, Events.WORKSPACE_CHANGED, { section: 'fields' })
}
