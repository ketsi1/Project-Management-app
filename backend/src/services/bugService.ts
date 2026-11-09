// Bug tracking. Who may do what (see auth/permissions.ts):
// - See: 'bugs.view_all' (or 'projects.view_all') sees every bug; everyone else sees bugs they
//   reported, bugs assigned to them and bugs in projects they can see.
// - Report: 'bugs.report'. Comment: anyone who can see the bug.
// - Change: 'bugs.manage' changes everything. Otherwise the reporter edits the details and the
//   status, the assignee updates the status, and nobody else changes anything.
// - Delete: 'bugs.manage', or the reporter while the bug is still open.
// Status, assignee, severity, priority and project changes are written to the bug's activity log.
import type { AuthContext } from '../auth/sessionStore.ts'
import { isUniqueViolation, prisma, type Db, type Prisma } from '../db/prisma.ts'
import { bugInclude, toBug, toBugComment, type BugCommentDto, type BugDto } from '../db/mappers.ts'
import type { BugPriority, BugResolution, BugSeverity, BugStatus } from '../generated/prisma/client.ts'
import { can } from '../middleware/auth.ts'
import { Events } from '../realtime/events.ts'
import { broadcastToOrg } from '../realtime/socket.ts'
import { ApiError } from '../utils/ApiError.ts'
import { newId } from '../utils/time.ts'
import type { BugCommentInput, CreateBugInput, UpdateBugInput } from '../validation/schemas.ts'
import { canSeeProject, seesAllProjects, visibleProjectWhere } from './visibility.ts'

const STATUS_LABELS: Record<BugStatus, string> = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed' }
const RESOLUTION_LABELS: Record<BugResolution, string> = { fixed: 'Fixed', wont_fix: 'Won’t fix', duplicate: 'Duplicate', cannot_reproduce: 'Cannot reproduce', by_design: 'By design' }
const SEVERITY_LABELS: Record<BugSeverity, string> = { critical: 'Critical', major: 'Major', minor: 'Minor', trivial: 'Trivial' }
const PRIORITY_LABELS: Record<BugPriority, string> = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' }
const isFinished = (status: BugStatus): boolean => status === 'resolved' || status === 'closed'

// Fields PATCH may change, and who may change them.
const FIELDS = ['projectId', 'workItemId', 'title', 'description', 'stepsToReproduce', 'expectedResult', 'actualResult', 'environment', 'severity', 'priority', 'status', 'resolution', 'assigneeId'] as const
const DETAIL_FIELDS = ['projectId', 'workItemId', 'title', 'description', 'stepsToReproduce', 'expectedResult', 'actualResult', 'environment', 'severity'] as const
const STATUS_FIELDS = ['status', 'resolution'] as const

type BugField = (typeof FIELDS)[number]
// The editable part of a bug: field name → value.
type BugValues = Pick<BugDto, BugField>
type BugChanges = Partial<BugValues>

const isBugField = (key: string): key is BugField => (FIELDS as readonly string[]).includes(key)

const managesBugs = (auth: AuthContext): boolean => can(auth, 'bugs.manage')
const seesAllBugs = (auth: AuthContext): boolean => can(auth, 'bugs.view_all') || seesAllProjects(auth)

async function findBug(organizationId: string, id: string): Promise<BugDto | null> {
  const bug = await prisma.bug.findFirst({ where: { id, organizationId }, include: bugInclude })
  return bug ? toBug(bug) : null
}

async function canSeeBug(auth: AuthContext, bug: BugDto): Promise<boolean> {
  if (seesAllBugs(auth)) return true
  if (bug.reporterId === auth.userId || bug.assigneeId === auth.userId) return true
  return canSeeProject(auth, bug.projectId)
}

// Bugs the caller may not see answer "not found", so nothing leaks.
async function findVisibleBug(auth: AuthContext, id: string): Promise<BugDto> {
  const bug = await findBug(auth.organizationId, id)
  if (!bug || !(await canSeeBug(auth, bug))) throw ApiError.notFound('Bug not found.')
  return bug
}

interface BugReferences {
  projectId?: string | undefined
  workItemId?: string | null | undefined
  assigneeId?: string | null | undefined
}

// The project, linked task and assignee must belong to the caller's organization.
async function assertReferences(auth: AuthContext, { projectId, workItemId, assigneeId }: BugReferences, current: Partial<BugDto> = {}): Promise<void> {
  const project = projectId ?? current.projectId
  if (projectId !== undefined) {
    const found = await prisma.project.findFirst({ where: { id: projectId, organizationId: auth.organizationId }, select: { id: true } })
    if (!found) throw ApiError.badRequest('Choose a valid project.')
    if (projectId !== current.projectId && !(await canSeeProject(auth, projectId))) throw ApiError.badRequest('Choose a valid project.')
  }
  if (workItemId) {
    const task = await prisma.workItem.findFirst({ where: { id: workItemId, organizationId: auth.organizationId }, select: { projectId: true } })
    if (!task) throw ApiError.badRequest('Choose a valid task to link.')
    if (task.projectId !== project) throw ApiError.badRequest('The linked task must be in the same project as the bug.')
  }
  if (assigneeId) {
    const member = await prisma.organizationMember.findFirst({ where: { userId: assigneeId, organizationId: auth.organizationId, status: 'active' }, select: { id: true } })
    if (!member) throw ApiError.badRequest('The assignee is not a member of this organization.')
  }
}

const addEvent = (db: Db, auth: AuthContext, bugId: string, body: string) =>
  db.bugComment.create({ data: { id: newId(), organizationId: auth.organizationId, bugId, authorId: auth.userId, kind: 'event', body } })

function changed(auth: AuthContext, action: string, bug: BugDto): void {
  broadcastToOrg(auth.organizationId, Events.BUGS_CHANGED, { action, id: bug.id, projectId: bug.projectId })
}

// --- Reading ---------------------------------------------------------------------

export async function listBugs(auth: AuthContext, projectId: string | undefined): Promise<BugDto[]> {
  const visibility: Prisma.BugWhereInput = seesAllBugs(auth)
    ? {}
    : { OR: [{ reporterId: auth.userId }, { assigneeId: auth.userId }, { project: visibleProjectWhere(auth) }] }
  const bugs = await prisma.bug.findMany({
    where: { organizationId: auth.organizationId, ...(projectId ? { projectId } : {}), ...visibility },
    include: bugInclude,
    orderBy: { number: 'desc' },
  })
  return bugs.map(toBug)
}

export async function getBug(auth: AuthContext, id: string): Promise<BugDto & { comments: BugCommentDto[] }> {
  const bug = await findVisibleBug(auth, id)
  const comments = await prisma.bugComment.findMany({
    where: { bugId: id },
    include: { author: { select: { fullName: true } } },
    orderBy: { seq: 'asc' },
  })
  return { ...bug, comments: comments.map(toBugComment) }
}

// --- Reporting -------------------------------------------------------------------

export async function createBug(auth: AuthContext, input: CreateBugInput): Promise<BugDto> {
  if (input.assigneeId && !managesBugs(auth)) throw ApiError.forbidden('Only people who triage bugs can assign them.')
  await assertReferences(auth, input)

  const id = newId()
  // Bug numbers count up per organization. If two reports race for the same number, try again.
  for (let attempt = 1; ; attempt += 1) {
    try {
      await prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<{ next: bigint | number }[]>`SELECT COALESCE(MAX(number), 0) + 1 AS next FROM bugs WHERE organization_id = ${auth.organizationId} FOR UPDATE`
        const next = rows[0]?.next ?? 1
        await tx.bug.create({ data: { id, organizationId: auth.organizationId, number: Number(next), reporterId: auth.userId, ...input } })
        await addEvent(tx, auth, id, 'reported this bug')
      })
      break
    } catch (error) {
      if (!isUniqueViolation(error) || attempt >= 3) throw error
    }
  }
  const bug = await findBug(auth.organizationId, id)
  if (!bug) throw ApiError.notFound('Bug not found.')
  changed(auth, 'created', bug)
  return bug
}

// --- Updating --------------------------------------------------------------------

const same = (a: unknown, b: unknown): boolean => (a ?? null) === (b ?? null)

// Picks the listed fields from a set of values (used to build "what changed" objects).
const pick = (values: BugChanges, keys: readonly BugField[]): BugChanges =>
  Object.fromEntries(keys.map((k) => [k, values[k]])) as BugChanges

function assertCanChange(auth: AuthContext, bug: BugDto, keys: BugField[]): void {
  if (managesBugs(auth)) return
  const allowed = new Set<BugField>()
  if (bug.reporterId === auth.userId) [...DETAIL_FIELDS, ...STATUS_FIELDS].forEach((k) => allowed.add(k))
  if (bug.assigneeId === auth.userId) STATUS_FIELDS.forEach((k) => allowed.add(k))
  const denied = keys.filter((k) => !allowed.has(k))
  if (denied.length === 0) return
  if (allowed.size === 0) throw ApiError.forbidden('Only the reporter, the assignee or someone who triages bugs can change this bug.')
  if (denied.some((k) => k === 'assigneeId' || k === 'priority')) throw ApiError.forbidden('Only people who triage bugs can assign or prioritize them.')
  throw ApiError.forbidden('As the assignee you can update the status. Ask the reporter or a triager to change the details.')
}

export async function updateBug(auth: AuthContext, id: string, changes: UpdateBugInput): Promise<BugDto> {
  const before = await findVisibleBug(auth, id)

  // Fields sent with their current value are not real changes (forms often send everything).
  const keys = Object.keys(changes).filter(isBugField).filter((k) => !same(changes[k], before[k]))
  if (keys.length === 0) return before
  assertCanChange(auth, before, keys)
  const requested = pick(changes, keys)
  await assertReferences(auth, requested, before)

  const next: BugDto = { ...before, ...requested }
  // A finished bug always has a resolution (default: fixed); reopening clears it.
  next.resolution = isFinished(next.status) ? (next.resolution ?? 'fixed') : null
  // Moving to another project unlinks a task from the old project.
  if (next.projectId !== before.projectId && !keys.includes('workItemId')) next.workItemId = null

  const data: Prisma.BugUncheckedUpdateInput = pick(next, FIELDS.filter((k) => !same(next[k], before[k])))
  if (next.status !== before.status) {
    const now = new Date()
    if (next.status === 'resolved') Object.assign(data, { resolvedAt: now, closedAt: null })
    else if (next.status === 'closed') Object.assign(data, { resolvedAt: before.resolvedAt ? new Date(before.resolvedAt) : now, closedAt: now })
    else Object.assign(data, { resolvedAt: null, closedAt: null })
  }

  const events = await describeChanges(auth, before, next)
  await prisma.$transaction(async (tx) => {
    await tx.bug.update({ where: { id }, data: { ...data, updatedAt: new Date() } })
    for (const text of events) await addEvent(tx, auth, id, text)
  })

  const bug = await findBug(auth.organizationId, id)
  if (!bug) throw ApiError.notFound('Bug not found.')
  changed(auth, 'updated', bug)
  return bug
}

// One readable line per meaningful change, for the activity log.
async function describeChanges(auth: AuthContext, before: BugDto, next: BugDto): Promise<string[]> {
  const events: string[] = []
  if (next.status !== before.status || next.resolution !== before.resolution) {
    const reopened = isFinished(before.status) && !isFinished(next.status)
    if (reopened) events.push('reopened this bug')
    else if (isFinished(next.status)) events.push(`marked this ${STATUS_LABELS[next.status]} (${RESOLUTION_LABELS[next.resolution ?? 'fixed']})`)
    else events.push(`changed the status from ${STATUS_LABELS[before.status]} to ${STATUS_LABELS[next.status]}`)
  }
  if (next.assigneeId !== before.assigneeId) {
    if (!next.assigneeId) events.push('unassigned this bug')
    else if (next.assigneeId === auth.userId) events.push('assigned this bug to themselves')
    else {
      const user = await prisma.user.findUnique({ where: { id: next.assigneeId }, select: { fullName: true } })
      events.push(`assigned this bug to ${user?.fullName ?? 'someone'}`)
    }
  }
  if (next.severity !== before.severity) events.push(`changed the severity from ${SEVERITY_LABELS[before.severity]} to ${SEVERITY_LABELS[next.severity]}`)
  if (next.priority !== before.priority) events.push(`changed the priority from ${PRIORITY_LABELS[before.priority]} to ${PRIORITY_LABELS[next.priority]}`)
  if (next.projectId !== before.projectId) {
    const project = await prisma.project.findUnique({ where: { id: next.projectId }, select: { name: true } })
    events.push(`moved this bug to ${project?.name ?? 'another project'}`)
  }
  return events
}

export async function deleteBug(auth: AuthContext, id: string): Promise<void> {
  const bug = await findVisibleBug(auth, id)
  const reporterMayDelete = bug.reporterId === auth.userId && bug.status === 'open'
  if (!managesBugs(auth) && !reporterMayDelete) {
    throw ApiError.forbidden('Only people who triage bugs can delete it. Reporters can delete their own bug while it is still open.')
  }
  await prisma.bug.delete({ where: { id } })
  changed(auth, 'deleted', bug)
}

// --- Comments --------------------------------------------------------------------

export async function addComment(auth: AuthContext, bugId: string, { body }: BugCommentInput): Promise<BugCommentDto> {
  const bug = await findVisibleBug(auth, bugId)
  const [comment] = await prisma.$transaction([
    prisma.bugComment.create({
      data: { id: newId(), organizationId: auth.organizationId, bugId, authorId: auth.userId, kind: 'comment', body },
      include: { author: { select: { fullName: true } } },
    }),
    prisma.bug.update({ where: { id: bugId }, data: { updatedAt: new Date() } }),
  ])
  changed(auth, 'commented', bug)
  return toBugComment(comment)
}
