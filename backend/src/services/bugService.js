// Bug tracking. Who may do what (see auth/permissions.js):
// - See: 'bugs.view_all' (or 'projects.view_all') sees every bug; everyone else sees bugs they
//   reported, bugs assigned to them and bugs in projects they can see.
// - Report: 'bugs.report'. Comment: anyone who can see the bug.
// - Change: 'bugs.manage' changes everything. Otherwise the reporter edits the details and the
//   status, the assignee updates the status, and nobody else changes anything.
// - Delete: 'bugs.manage', or the reporter while the bug is still open.
// Status, assignee, severity, priority and project changes are written to the bug's activity log.
import { isUniqueViolation, prisma } from '../db/prisma.js'
import { bugInclude, toBug, toBugComment } from '../db/mappers.js'
import { can } from '../middleware/auth.js'
import { Events } from '../realtime/events.js'
import { broadcastToOrg } from '../realtime/socket.js'
import { ApiError } from '../utils/ApiError.js'
import { newId } from '../utils/time.js'
import { canSeeProject, seesAllProjects, visibleProjectWhere } from './visibility.js'

const STATUS_LABELS = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed' }
const RESOLUTION_LABELS = { fixed: 'Fixed', wont_fix: 'Won’t fix', duplicate: 'Duplicate', cannot_reproduce: 'Cannot reproduce', by_design: 'By design' }
const SEVERITY_LABELS = { critical: 'Critical', major: 'Major', minor: 'Minor', trivial: 'Trivial' }
const PRIORITY_LABELS = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' }
const FINISHED = ['resolved', 'closed']

// Fields PATCH may change, and who may change them.
const FIELDS = ['projectId', 'workItemId', 'title', 'description', 'stepsToReproduce', 'expectedResult', 'actualResult', 'environment', 'severity', 'priority', 'status', 'resolution', 'assigneeId']
const DETAIL_FIELDS = ['projectId', 'workItemId', 'title', 'description', 'stepsToReproduce', 'expectedResult', 'actualResult', 'environment', 'severity']
const STATUS_FIELDS = ['status', 'resolution']

const managesBugs = (auth) => can(auth, 'bugs.manage')
const seesAllBugs = (auth) => can(auth, 'bugs.view_all') || seesAllProjects(auth)

async function findBug(organizationId, id) {
  const bug = await prisma.bug.findFirst({ where: { id, organizationId }, include: bugInclude })
  return bug ? toBug(bug) : null
}

async function canSeeBug(auth, bug) {
  if (seesAllBugs(auth)) return true
  if (bug.reporterId === auth.userId || bug.assigneeId === auth.userId) return true
  return canSeeProject(auth, bug.projectId)
}

// Bugs the caller may not see answer "not found", so nothing leaks.
async function findVisibleBug(auth, id) {
  const bug = await findBug(auth.organizationId, id)
  if (!bug || !(await canSeeBug(auth, bug))) throw ApiError.notFound('Bug not found.')
  return bug
}

// The project, linked task and assignee must belong to the caller's organization.
async function assertReferences(auth, { projectId, workItemId, assigneeId }, current = {}) {
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

const addEvent = (db, auth, bugId, body) =>
  db.bugComment.create({ data: { id: newId(), organizationId: auth.organizationId, bugId, authorId: auth.userId, kind: 'event', body } })

function changed(auth, action, bug) {
  broadcastToOrg(auth.organizationId, Events.BUGS_CHANGED, { action, id: bug.id, projectId: bug.projectId })
}

// --- Reading ---------------------------------------------------------------------

export async function listBugs(auth, projectId) {
  const visibility = seesAllBugs(auth)
    ? {}
    : { OR: [{ reporterId: auth.userId }, { assigneeId: auth.userId }, { project: visibleProjectWhere(auth) }] }
  const bugs = await prisma.bug.findMany({
    where: { organizationId: auth.organizationId, ...(projectId ? { projectId } : {}), ...visibility },
    include: bugInclude,
    orderBy: { number: 'desc' },
  })
  return bugs.map(toBug)
}

export async function getBug(auth, id) {
  const bug = await findVisibleBug(auth, id)
  const comments = await prisma.bugComment.findMany({
    where: { bugId: id },
    include: { author: { select: { fullName: true } } },
    orderBy: { seq: 'asc' },
  })
  return { ...bug, comments: comments.map(toBugComment) }
}

// --- Reporting -------------------------------------------------------------------

export async function createBug(auth, input) {
  if (input.assigneeId && !managesBugs(auth)) throw ApiError.forbidden('Only people who triage bugs can assign them.')
  await assertReferences(auth, input)

  const id = newId()
  // Bug numbers count up per organization. If two reports race for the same number, try again.
  for (let attempt = 1; ; attempt += 1) {
    try {
      await prisma.$transaction(async (tx) => {
        const [{ next }] = await tx.$queryRaw`SELECT COALESCE(MAX(number), 0) + 1 AS next FROM bugs WHERE organization_id = ${auth.organizationId} FOR UPDATE`
        await tx.bug.create({ data: { id, organizationId: auth.organizationId, number: Number(next), reporterId: auth.userId, ...input } })
        await addEvent(tx, auth, id, 'reported this bug')
      })
      break
    } catch (error) {
      if (!isUniqueViolation(error) || attempt >= 3) throw error
    }
  }
  const bug = await findBug(auth.organizationId, id)
  changed(auth, 'created', bug)
  return bug
}

// --- Updating --------------------------------------------------------------------

const same = (a, b) => (a ?? null) === (b ?? null)

function assertCanChange(auth, bug, keys) {
  if (managesBugs(auth)) return
  const allowed = new Set()
  if (bug.reporterId === auth.userId) [...DETAIL_FIELDS, ...STATUS_FIELDS].forEach((k) => allowed.add(k))
  if (bug.assigneeId === auth.userId) STATUS_FIELDS.forEach((k) => allowed.add(k))
  const denied = keys.filter((k) => !allowed.has(k))
  if (denied.length === 0) return
  if (allowed.size === 0) throw ApiError.forbidden('Only the reporter, the assignee or someone who triages bugs can change this bug.')
  if (denied.some((k) => k === 'assigneeId' || k === 'priority')) throw ApiError.forbidden('Only people who triage bugs can assign or prioritize them.')
  throw ApiError.forbidden('As the assignee you can update the status. Ask the reporter or a triager to change the details.')
}

export async function updateBug(auth, id, changes) {
  const before = await findVisibleBug(auth, id)

  // Fields sent with their current value are not real changes (forms often send everything).
  const keys = Object.keys(changes).filter((k) => FIELDS.includes(k) && !same(changes[k], before[k]))
  if (keys.length === 0) return before
  assertCanChange(auth, before, keys)
  await assertReferences(auth, Object.fromEntries(keys.map((k) => [k, changes[k]])), before)

  const next = { ...before, ...Object.fromEntries(keys.map((k) => [k, changes[k]])) }
  // A finished bug always has a resolution (default: fixed); reopening clears it.
  next.resolution = FINISHED.includes(next.status) ? (next.resolution ?? 'fixed') : null
  // Moving to another project unlinks a task from the old project.
  if (next.projectId !== before.projectId && !keys.includes('workItemId')) next.workItemId = null

  const data = Object.fromEntries(FIELDS.filter((k) => !same(next[k], before[k])).map((k) => [k, next[k]]))
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
  changed(auth, 'updated', bug)
  return bug
}

// One readable line per meaningful change, for the activity log.
async function describeChanges(auth, before, next) {
  const events = []
  if (next.status !== before.status || next.resolution !== before.resolution) {
    const reopened = FINISHED.includes(before.status) && !FINISHED.includes(next.status)
    if (reopened) events.push('reopened this bug')
    else if (FINISHED.includes(next.status)) events.push(`marked this ${STATUS_LABELS[next.status]} (${RESOLUTION_LABELS[next.resolution]})`)
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

export async function deleteBug(auth, id) {
  const bug = await findVisibleBug(auth, id)
  const reporterMayDelete = bug.reporterId === auth.userId && bug.status === 'open'
  if (!managesBugs(auth) && !reporterMayDelete) {
    throw ApiError.forbidden('Only people who triage bugs can delete it. Reporters can delete their own bug while it is still open.')
  }
  await prisma.bug.delete({ where: { id } })
  changed(auth, 'deleted', bug)
}

// --- Comments --------------------------------------------------------------------

export async function addComment(auth, bugId, { body }) {
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
