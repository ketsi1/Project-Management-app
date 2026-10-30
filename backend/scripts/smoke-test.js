// End-to-end check against a running server with the seed data loaded:
//   npm run smoke            (uses http://localhost:4000, or set API_BASE)
// It creates a fresh organization each run (directly in the database, using backend/.env) and only
// changes that organization's data, apart from read-only and permission-denied calls against Acme Corp.
import { io } from 'socket.io-client'
import { hashPassword } from '../src/auth/password.js'
import { query, transaction } from '../src/db/pool.js'
import { createStarterContent } from '../src/services/organizationSetup.js'
import { newId } from '../src/utils/time.js'

// Sign-up only joins an existing organization, so the test makes its own org + owner here.
async function createTestOrganization({ orgName, fullName, email, password }) {
  const organizationId = newId()
  const ownerId = newId()
  const passwordHash = await hashPassword(password)
  await transaction(async (c) => {
    await query('INSERT INTO organizations (id, name) VALUES (?, ?)', [organizationId, orgName], c)
    await query('INSERT INTO users (id, full_name, email, password_hash) VALUES (?, ?, ?, ?)', [ownerId, fullName, email, passwordHash], c)
    await query(
      "INSERT INTO organization_members (id, organization_id, user_id, role, status) VALUES (?, ?, ?, 'owner', 'active')",
      [newId(), organizationId, ownerId],
      c,
    )
    await createStarterContent(c, { organizationId, ownerId })
  })
}

const BASE = process.env.API_BASE ?? 'http://localhost:4000'
const API = `${BASE}/api`

let failures = 0
function check(label, condition, detail) {
  if (condition) console.info(`  ✓ ${label}`)
  else {
    failures += 1
    console.error(`  ✗ ${label}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`)
  }
}

async function call(method, path, { token, body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = response.status === 204 ? undefined : await response.json().catch(() => ({}))
  return { status: response.status, data }
}

function connectSocket(token) {
  return new Promise((resolve, reject) => {
    const socket = io(BASE, { auth: { token }, transports: ['websocket'], reconnection: false })
    socket.once('connect', () => resolve(socket))
    socket.once('connect_error', (error) => {
      socket.close()
      reject(error)
    })
  })
}

function waitForEvent(socket, event, ms = 3000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms)
    socket.once(event, (payload) => {
      clearTimeout(timer)
      resolve(payload ?? {})
    })
  })
}

const sockets = []
try {
  console.info(`Smoke test against ${API}\n`)

  console.info('Auth')
  const stamp = Date.now()
  const orgName = `Smoke Org ${stamp}`
  const email = `smoke-${stamp}@example.com`
  await createTestOrganization({ orgName, fullName: 'Smoke Tester', email, password: 'correct-horse-9' })

  const joinerEmail = `joiner-${stamp}@example.com`
  const reg = await call('POST', '/auth/register', {
    body: { fullName: 'New Joiner', organizationName: orgName, email: joinerEmail, password: 'correct-horse-9' },
  })
  check('sign-up returns 201, pending, with no token', reg.status === 201 && reg.data?.pending === true && !reg.data.token, reg)
  const noOrg = await call('POST', '/auth/register', {
    body: { fullName: 'X', organizationName: `No Such Org ${stamp}`, email: `x-${stamp}@example.com`, password: 'correct-horse-9' },
  })
  check('sign-up to an unknown organization → 404', noOrg.status === 404, noOrg)
  const pendingLogin = await call('POST', '/auth/login', { body: { email: joinerEmail, password: 'correct-horse-9' } })
  check('pending account cannot log in → 403', pendingLogin.status === 403 && /approve/.test(pendingLogin.data.message), pendingLogin)
  const dup = await call('POST', '/auth/register', {
    body: { fullName: 'New Joiner', organizationName: orgName, email: joinerEmail, password: 'correct-horse-9' },
  })
  check('duplicate email → 409', dup.status === 409 && dup.data.message === 'An account with this email already exists.', dup)
  const weak = await call('POST', '/auth/register', {
    body: { fullName: 'X', organizationName: 'Y', email: 'weak@example.com', password: 'short' },
  })
  check('short password → 400 with message', weak.status === 400 && /at least 8/.test(weak.data.message), weak)

  const owner = await call('POST', '/auth/login', { body: { email: email.toUpperCase(), password: 'correct-horse-9' } })
  check('login (email is case-insensitive)', owner.status === 200 && owner.data.organization.name === orgName, owner)
  const wrong = await call('POST', '/auth/login', { body: { email, password: 'nope-nope-nope' } })
  check('wrong password → 401', wrong.status === 401 && wrong.data.message === 'Email or password is incorrect.', wrong)
  const sarah = await call('POST', '/auth/login', { body: { email: 'sarah@acme.com', password: '12345678' } })
  check('seeded developer sarah@acme.com logs in', sarah.status === 200 && sarah.data.role === 'member', sarah)
  const alex = await call('POST', '/auth/login', { body: { email: 'alex@acme.com', password: '87654321' } })
  check('seeded manager alex@acme.com logs in', alex.status === 200 && alex.data.role === 'owner', alex)
  check('no token → 401', (await call('GET', '/workspace')).status === 401)
  check('garbage token → 401', (await call('GET', '/workspace', { token: 'abc.def.ghi' })).status === 401)

  const T = owner.data.token
  const S = sarah.data.token

  console.info('\nSign-up approval')
  const pendingWs = await call('GET', '/workspace', { token: T })
  const joiner = pendingWs.data.pendingMembers?.find((m) => m.email === joinerEmail)
  check(
    'manager sees the sign-up under pendingMembers, not members',
    !!joiner && !pendingWs.data.members.some((m) => m.email === joinerEmail),
    pendingWs.data,
  )
  check('employee cannot approve → 403', (await call('POST', `/members/${joiner?.id}/approve`, { token: S })).status === 403)
  check('employee workspace has no pending list', (await call('GET', '/workspace', { token: S })).data.pendingMembers.length === 0)
  check('manager approves → 204', (await call('POST', `/members/${joiner?.id}/approve`, { token: T })).status === 204)
  const joinerLogin = await call('POST', '/auth/login', { body: { email: joinerEmail, password: 'correct-horse-9' } })
  check('approved account logs in as an employee', joinerLogin.status === 200 && joinerLogin.data.role === 'member', joinerLogin)
  check('remove the approved member → 204', (await call('DELETE', `/members/${joiner?.id}`, { token: T })).status === 204)

  console.info('\nWorkspace & org scoping')
  const ws = await call('GET', '/workspace', { token: T })
  check(
    'new org gets 4 default statuses and its owner as member',
    ws.status === 200 && ws.data.statuses.length === 4 && ws.data.members.length === 1,
    ws,
  )
  const acmeWs = await call('GET', '/workspace', { token: S })
  check('Acme workspace has 3 members and 2 custom fields', acmeWs.data.members.length === 3 && acmeWs.data.fields.length === 2, acmeWs.data)
  const projects = await call('GET', '/projects', { token: T })
  check('new org sees only its own sample project', projects.data.length === 1 && projects.data[0].name === 'Getting started', projects)
  const acmeItems = await call('GET', '/work-items', { token: S })
  check('Acme member sees the 10 seeded items', acmeItems.data.length === 10, acmeItems.data.length)
  const filtered = await call('GET', `/work-items?projectId=55555555-5555-5555-5555-555555555551`, { token: S })
  check('?projectId filter works', filtered.data.length === 5, filtered.data.length)
  const foreign = await call('PATCH', `/work-items/${acmeItems.data[0].id}`, { token: T, body: { title: 'hijack' } })
  check("cannot edit another org's item → 404", foreign.status === 404, foreign)

  console.info('\nCRUD (work items)')
  const projectId = projects.data[0].id
  const [todo, doing] = ws.data.statuses
  const created = await call('POST', '/work-items', {
    token: T,
    body: {
      projectId,
      title: 'Smoke item',
      description: 'made by smoke test',
      statusId: todo.id,
      priority: 'high',
      assigneeId: owner.data.user.id,
      dueDate: '2030-01-31',
      customValues: {},
    },
  })
  check('create work item → 201', created.status === 201 && created.data.dueDate === '2030-01-31', created)
  const badRef = await call('POST', '/work-items', {
    token: T,
    body: { projectId, title: 'x', statusId: acmeWs.data.statuses[0].id, priority: 'low' },
  })
  check("using another org's status → 400", badRef.status === 400 && badRef.data.message === 'Choose a valid status.', badRef)
  const noTitle = await call('POST', '/work-items', { token: T, body: { projectId, title: '  ', statusId: todo.id } })
  check('blank title → 400 "Title is required."', noTitle.status === 400 && noTitle.data.message === 'Title is required.', noTitle)

  console.info('\nRealtime')
  const ownerSocket = await connectSocket(T)
  sockets.push(ownerSocket)
  check('socket connects with the login token', ownerSocket.connected)
  const acmeSocket = await connectSocket(S)
  sockets.push(acmeSocket)
  let badSocketError = null
  try {
    sockets.push(await connectSocket('not-a-token'))
  } catch (error) {
    badSocketError = error.message
  }
  check('socket with a bad token is refused', badSocketError === 'unauthorized', badSocketError)

  const ownEvent = waitForEvent(ownerSocket, 'workItems:changed')
  const leakedEvent = waitForEvent(acmeSocket, 'workItems:changed', 1500)
  const patched = await call('PATCH', `/work-items/${created.data.id}`, { token: T, body: { statusId: doing.id } })
  check('PATCH work item → 200 with new status', patched.status === 200 && patched.data.statusId === doing.id, patched)
  const payload = await ownEvent
  check('same-org socket receives workItems:changed', payload?.action === 'updated' && payload.id === created.data.id, payload)
  check('other-org socket does not receive it', (await leakedEvent) === null)

  const del = await call('DELETE', `/work-items/${created.data.id}`, { token: T })
  check('delete work item → 204', del.status === 204, del)

  console.info('\nPermissions')
  const denied = await call('PUT', '/organization', {
    token: S,
    body: { name: 'Hacked', terminology: { project: 'P', projects: 'Ps', task: 'T', tasks: 'Ts' } },
  })
  check('member cannot change organization → 403', denied.status === 403 && denied.data.message, denied)
  check('member cannot create a project → 403', (await call('POST', '/projects', { token: S, body: { name: 'x' } })).status === 403)
  check('member cannot invite → 403', (await call('POST', '/members', { token: S, body: { fullName: 'x', email: 'x@x.io', role: 'member' } })).status === 403)
  const memberItem = await call('POST', '/work-items', {
    token: S,
    body: { projectId: '55555555-5555-5555-5555-555555555551', title: 'Smoke (member)', statusId: '33333333-3333-3333-3333-333333333301' },
  })
  check('member CAN create work items', memberItem.status === 201 && memberItem.data.createdById === sarah.data.user.id, memberItem)
  check('member CAN delete work items they created', (await call('DELETE', `/work-items/${memberItem.data?.id}`, { token: S })).status === 204)

  console.info('\nEmployee limits')
  const A = alex.data.token
  const statusTodo = '33333333-3333-3333-3333-333333333301'
  const statusDoing = '33333333-3333-3333-3333-333333333302'
  const sarahsTask = '88888888-8888-8888-8888-888888888802' // created by Alex, assigned to Sarah, "In progress"
  const davidsTask = '88888888-8888-8888-8888-888888888801' // created by Alex, assigned to David
  check(
    'member CAN change the status of a manager task assigned to them',
    (await call('PATCH', `/work-items/${sarahsTask}`, { token: S, body: { statusId: statusTodo } })).data?.statusId === statusTodo,
  )
  await call('PATCH', `/work-items/${sarahsTask}`, { token: S, body: { statusId: statusDoing } })
  check(
    'member cannot edit other fields of a manager task → 403',
    (await call('PATCH', `/work-items/${sarahsTask}`, { token: S, body: { title: 'renamed' } })).status === 403,
  )
  check('member cannot delete a manager task → 403', (await call('DELETE', `/work-items/${sarahsTask}`, { token: S })).status === 403)
  check(
    "member cannot change someone else's task → 403",
    (await call('PATCH', `/work-items/${davidsTask}`, { token: S, body: { statusId: statusTodo } })).status === 403,
  )

  const hidden = await call('POST', '/projects', { token: A, body: { name: `Smoke hidden ${Date.now()}`, description: '' } })
  const hiddenTask = await call('POST', '/work-items', {
    token: A,
    body: { projectId: hidden.data.id, title: 'Smoke (hidden)', statusId: statusTodo, assigneeId: acmeWs.data.members.find((m) => m.email === 'david@acme.com')?.id },
  })
  const sarahProjects = async () => (await call('GET', '/projects', { token: S })).data.map((p) => p.id)
  check('member does not see a project without their tasks', !(await sarahProjects()).includes(hidden.data.id))
  check('…nor its work items', !(await call('GET', '/work-items', { token: S })).data.some((i) => i.id === hiddenTask.data.id))
  check('…and opening it directly → 404', (await call('GET', `/work-items?projectId=${hidden.data.id}`, { token: S })).status === 404)
  check(
    '…and cannot add work to it → 400',
    (await call('POST', '/work-items', { token: S, body: { projectId: hidden.data.id, title: 'x', statusId: statusTodo } })).status === 400,
  )
  check('manager still sees it', (await call('GET', '/projects', { token: A })).data.some((p) => p.id === hidden.data.id))
  await call('PATCH', `/work-items/${hiddenTask.data.id}`, { token: A, body: { assigneeId: sarah.data.user.id } })
  check('member sees the project once a task there is assigned to them', (await sarahProjects()).includes(hidden.data.id))
  check('delete the test project → 204', (await call('DELETE', `/projects/${hidden.data.id}`, { token: A })).status === 204)

  console.info('\nSettings (owner)')
  const org = await call('PUT', '/organization', {
    token: T,
    body: { name: 'Smoke Org 2', terminology: { project: 'Initiative', projects: 'Initiatives', task: 'Activity', tasks: 'Activities' } },
  })
  check('owner updates organization → 204', org.status === 204, org)
  const status = await call('POST', '/statuses', { token: T, body: { name: 'Blocked', category: 'active', color: '#ef4444', position: 4 } })
  check('create status → 201', status.status === 201 && status.data.name === 'Blocked', status)
  const upd = await call('PUT', `/statuses/${status.data.id}`, { token: T, body: { ...status.data, name: 'On hold' } })
  check('update status → 200', upd.status === 200 && upd.data.name === 'On hold', upd)
  const delStatus = await call('DELETE', `/statuses/${todo.id}?moveTo=${doing.id}`, { token: T })
  check('delete status moving its items → 204', delStatus.status === 204, delStatus)
  const items = await call('GET', '/work-items', { token: T })
  check('items from the deleted status were moved', items.data.every((i) => i.statusId !== todo.id))
  const selfMove = await call('DELETE', `/statuses/${doing.id}?moveTo=${doing.id}`, { token: T })
  check('moving items into the status being deleted → 400', selfMove.status === 400, selfMove)
  const field = await call('POST', '/fields', { token: T, body: { label: 'Budget', type: 'number', options: [] } })
  check('create field → 201', field.status === 201 && field.data.label === 'Budget', field)
  check('delete field → 204', (await call('DELETE', `/fields/${field.data.id}`, { token: T })).status === 204)
  const invite = await call('POST', '/members', { token: T, body: { fullName: 'New Person', email: `invitee-${Date.now()}@example.com`, role: 'admin' } })
  check('invite member → 201 with Member', invite.status === 201 && invite.data.role === 'admin', invite)
  const invitedLogin = await call('POST', '/auth/login', { body: { email: invite.data.email, password: 'password123' } })
  check('invited member cannot log in before accepting', invitedLogin.status === 401)
  check('remove member → 204', (await call('DELETE', `/members/${invite.data.id}`, { token: T })).status === 204)
  check('cannot remove the owner/yourself → 400', (await call('DELETE', `/members/${owner.data.user.id}`, { token: T })).status === 400)
  const proj = await call('POST', '/projects', { token: T, body: { name: 'Second', description: '' } })
  check('create project → 201', proj.status === 201, proj)
  check('update project → 200', (await call('PUT', `/projects/${proj.data.id}`, { token: T, body: { name: 'Second!', description: 'x' } })).data?.name === 'Second!')
  check('delete project → 204', (await call('DELETE', `/projects/${proj.data.id}`, { token: T })).status === 204)

  console.info('\nLogout')
  const disconnected = new Promise((resolve) => ownerSocket.once('disconnect', (reason) => resolve(reason)))
  check('logout → 204', (await call('POST', '/auth/logout', { token: T })).status === 204)
  check('token no longer works after logout → 401', (await call('GET', '/workspace', { token: T })).status === 401)
  check("logout closes that session's socket", (await Promise.race([disconnected, new Promise((r) => setTimeout(() => r(null), 2000))])) !== null)
  check('other sessions keep working', (await call('GET', '/workspace', { token: S })).status === 200)
} catch (error) {
  failures += 1
  console.error('Smoke test crashed:', error)
} finally {
  sockets.forEach((socket) => socket.close())
}

console.info(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
