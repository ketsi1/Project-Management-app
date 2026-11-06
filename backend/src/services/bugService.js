// Bug tracking. Who may do what (see auth/permissions.js):
// - See: 'bugs.view_all' (or 'projects.view_all') sees every bug; everyone else sees bugs they
//   reported, bugs assigned to them and bugs in projects they can see.
// - Report: 'bugs.report'. Comment: anyone who can see the bug.
// - Change: 'bugs.manage' changes everything. Otherwise the reporter edits the details and the
//   status, the assignee updates the status, and nobody else changes anything.
// - Delete: 'bugs.manage', or the reporter while the bug is still open.
// Status, assignee, severity, priority and project changes are written to the bug's activity log.
import { query, transaction } from '../db/pool.js'
import { toBug, toBugComment } from '../db/mappers.js'
import { can } from '../middleware/auth.js'
import { Events } from '../realtime/events.js'
import { broadcastToOrg } from '../realtime/socket.js'
import { ApiError } from '../utils/ApiError.js'
import { newId } from '../utils/time.js'
import { canSeeProject, seesAllProjects, visibleProjectsFilter } from './visibility.js'

const STATUS_LABELS = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed' }
const RESOLUTION_LABELS = { fixed: 'Fixed', wont_fix: 'Won’t fix', duplicate: 'Duplicate', cannot_reproduce: 'Cannot reproduce', by_design: 'By design' }
const SEVERITY_LABELS = { critical: 'Critical', major: 'Major', minor: 'Minor', trivial: 'Trivial' }
const PRIORITY_LABELS = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' }
const FINISHED = ['resolved', 'closed']

// Which request fields map to which column, and who may change them.
const COLUMNS = {
  projectId: 'project_id',
  workItemId: 'work_item_id',
  title: 'title',
  description: 'description',
  stepsToReproduce: 'steps_to_reproduce',
  expectedResult: 'expected_result',
  actualResult: 'actual_result',
  environment: 'environment',
  severity: 'severity',
  priority: 'priority',
  status: 'status',
  resolution: 'resolution',
  assigneeId: 'assignee_id',
}
const DETAIL_FIELDS = ['projectId', 'workItemId', 'title', 'description', 'stepsToReproduce', 'expectedResult', 'actualResult', 'environment', 'severity']
const STATUS_FIELDS = ['status', 'resolution']

const managesBugs = (auth) => can(auth, 'bugs.manage')
const seesAllBugs = (auth) => can(auth, 'bugs.view_all') || seesAllProjects(auth)

const BUG_SELECT = `SELECT b.*,
  (SELECT COUNT(*) FROM bug_comments c WHERE c.bug_id = b.id AND c.kind = 'comment') AS comment_count
  FROM bugs b`

async function findBug(organizationId, id) {
  const rows = await query(`${BUG_SELECT} WHERE b.id = ? AND b.organization_id = ?`, [id, organizationId])
  return rows[0] ? toBug(rows[0]) : null
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
    const rows = await query('SELECT 1 FROM projects WHERE id = ? AND organization_id = ?', [projectId, auth.organizationId])
    if (rows.length === 0) throw ApiError.badRequest('Choose a valid project.')
    if (!seesAllProjects(auth) && !(await canSeeProject(auth, projectId)) && projectId !== current.projectId) {
      throw ApiError.badRequest('Choose a valid project.')
    }
  }
  if (workItemId) {
    const rows = await query('SELECT project_id FROM work_items WHERE id = ? AND organization_id = ?', [workItemId, auth.organizationId])
    if (rows.length === 0) throw ApiError.badRequest('Choose a valid task to link.')
    if (rows[0].project_id !== project) throw ApiError.badRequest('The linked task must be in the same project as the bug.')
  }
  if (assigneeId) {
    const rows = await query("SELECT 1 FROM organization_members WHERE user_id = ? AND organization_id = ? AND status = 'active'", [assigneeId, auth.organizationId])
    if (rows.length === 0) throw ApiError.badRequest('The assignee is not a member of this organization.')
  }
}

async function addEvent(auth, bugId, body, connection) {
  await query(
    "INSERT INTO bug_comments (id, organization_id, bug_id, author_id, kind, body) VALUES (?, ?, ?, ?, 'event', ?)",
    [newId(), auth.organizationId, bugId, auth.userId, body],
    connection,
  )
}

function changed(auth, action, bug) {
  broadcastToOrg(auth.organizationId, Events.BUGS_CHANGED, { action, id: bug.id, projectId: bug.projectId })
}

// --- Reading ---------------------------------------------------------------------

export async function listBugs(auth, projectId) {
  const conditions = ['b.organization_id = ?']
  const params = [auth.organizationId]
  if (projectId) {
    conditions.push('b.project_id = ?')
    params.push(projectId)
  }
  if (!seesAllBugs(auth)) {
    const filter = visibleProjectsFilter(auth, 'b.project_id')
    conditions.push(`(b.reporter_id = ? OR b.assignee_id = ? OR ${filter.sql})`)
    params.push(auth.userId, auth.userId, ...filter.params)
  }
  const rows = await query(`${BUG_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY b.number DESC`, params)
  return rows.map(toBug)
}

export async function getBug(auth, id) {
  const bug = await findVisibleBug(auth, id)
  const rows = await query(
    `SELECT c.*, u.full_name AS author_name FROM bug_comments c
       LEFT JOIN users u ON u.id = c.author_id
      WHERE c.bug_id = ? ORDER BY c.seq ASC`,
    [id],
  )
  return { ...bug, comments: rows.map(toBugComment) }
}

// --- Reporting -------------------------------------------------------------------

export async function createBug(auth, input) {
  if (input.assigneeId && !managesBugs(auth)) throw ApiError.forbidden('Only people who triage bugs can assign them.')
  await assertReferences(auth, input)

  const id = newId()
  // Bug numbers count up per organization. If two reports race for the same number, try again.
  for (let attempt = 1; ; attempt += 1) {
    try {
      await transaction(async (connection) => {
        const [{ next }] = await query('SELECT COALESCE(MAX(number), 0) + 1 AS next FROM bugs WHERE organization_id = ? FOR UPDATE', [auth.organizationId], connection)
        await query(
          `INSERT INTO bugs (id, organization_id, project_id, work_item_id, number, title, description, steps_to_reproduce,
                             expected_result, actual_result, environment, severity, priority, reporter_id, assignee_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            auth.organizationId,
            input.projectId,
            input.workItemId,
            next,
            input.title,
            input.description,
            input.stepsToReproduce,
            input.expectedResult,
            input.actualResult,
            input.environment,
            input.severity,
            input.priority,
            auth.userId,
            input.assigneeId,
          ],
          connection,
        )
        await addEvent(auth, id, 'reported this bug', connection)
      })
      break
    } catch (error) {
      if (error?.code !== 'ER_DUP_ENTRY' || attempt >= 3) throw error
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
  const keys = Object.keys(changes).filter((k) => k in COLUMNS && !same(changes[k], before[k]))
  if (keys.length === 0) return before
  assertCanChange(auth, before, keys)
  await assertReferences(auth, Object.fromEntries(keys.map((k) => [k, changes[k]])), before)

  const next = { ...before, ...Object.fromEntries(keys.map((k) => [k, changes[k]])) }
  // A finished bug always has a resolution (default: fixed); reopening clears it.
  if (FINISHED.includes(next.status)) next.resolution = next.resolution ?? 'fixed'
  else next.resolution = null
  // Moving to another project unlinks a task from the old project.
  if (next.projectId !== before.projectId && !keys.includes('workItemId')) next.workItemId = null

  const columns = Object.keys(COLUMNS).filter((k) => !same(next[k], before[k]))
  const sets = columns.map((k) => `${COLUMNS[k]} = ?`)
  const values = columns.map((k) => next[k])
  if (next.status !== before.status) {
    if (next.status === 'resolved') sets.push('resolved_at = CURRENT_TIMESTAMP', 'closed_at = NULL')
    else if (next.status === 'closed') sets.push('resolved_at = COALESCE(resolved_at, CURRENT_TIMESTAMP)', 'closed_at = CURRENT_TIMESTAMP')
    else sets.push('resolved_at = NULL', 'closed_at = NULL')
  }

  const events = await describeChanges(auth, before, next)
  await transaction(async (connection) => {
    if (sets.length > 0) {
      await query(`UPDATE bugs SET ${[...sets, 'updated_at = CURRENT_TIMESTAMP'].join(', ')} WHERE id = ? AND organization_id = ?`, [...values, id, auth.organizationId], connection)
    }
    for (const text of events) await addEvent(auth, id, text, connection)
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
      const [user] = await query('SELECT full_name FROM users WHERE id = ?', [next.assigneeId])
      events.push(`assigned this bug to ${user?.full_name ?? 'someone'}`)
    }
  }
  if (next.severity !== before.severity) events.push(`changed the severity from ${SEVERITY_LABELS[before.severity]} to ${SEVERITY_LABELS[next.severity]}`)
  if (next.priority !== before.priority) events.push(`changed the priority from ${PRIORITY_LABELS[before.priority]} to ${PRIORITY_LABELS[next.priority]}`)
  if (next.projectId !== before.projectId) {
    const [project] = await query('SELECT name FROM projects WHERE id = ?', [next.projectId])
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
  await query('DELETE FROM bugs WHERE id = ? AND organization_id = ?', [id, auth.organizationId])
  changed(auth, 'deleted', bug)
}

// --- Comments --------------------------------------------------------------------

export async function addComment(auth, bugId, { body }) {
  const bug = await findVisibleBug(auth, bugId)
  const id = newId()
  await query("INSERT INTO bug_comments (id, organization_id, bug_id, author_id, kind, body) VALUES (?, ?, ?, ?, 'comment', ?)", [
    id,
    auth.organizationId,
    bugId,
    auth.userId,
    body,
  ])
  await query('UPDATE bugs SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [bugId])
  changed(auth, 'commented', bug)
  const rows = await query('SELECT c.*, u.full_name AS author_name FROM bug_comments c LEFT JOIN users u ON u.id = c.author_id WHERE c.id = ?', [id])
  return toBugComment(rows[0])
}
