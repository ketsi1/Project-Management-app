// End-to-end check against a running server with the seed data loaded:
//   npm run smoke            (uses http://localhost:4000, or set API_BASE)
// It creates a fresh organization each run (directly in the database, using backend/.env) and only
// changes that organization's data, apart from read-only and permission-denied calls against Acme Corp.
import { io } from 'socket.io-client'
import { hashPassword } from '../src/auth/password.js'
import { prisma } from '../src/db/prisma.js'
import { ensureDefaultRoles } from '../src/services/accessControl.js'
import { createStarterContent } from '../src/services/organizationSetup.js'
import { newId } from '../src/utils/time.js'

// Sign-up only joins an existing organization, so the test makes its own org + owner here.
async function createTestOrganization({ orgName, fullName, email, password }) {
  const organizationId = newId()
  const ownerId = newId()
  const passwordHash = await hashPassword(password)
  await prisma.$transaction(async (tx) => {
    await tx.organization.create({ data: { id: organizationId, name: orgName } })
    const roleIds = await ensureDefaultRoles(tx, organizationId)
    await tx.user.create({
      data: {
        id: ownerId,
        fullName,
        email,
        passwordHash,
        memberships: { create: { id: newId(), organizationId, roleId: roleIds.owner, status: 'active' } },
      },
    })
    await createStarterContent(tx, { organizationId, ownerId })
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
  check('Acme workspace has the seeded members and custom fields', acmeWs.data.members.length >= 3 && acmeWs.data.fields.length >= 2, acmeWs.data)
  const projects = await call('GET', '/projects', { token: T })
  check('new org sees only its own sample project', projects.data.length === 1 && projects.data[0].name === 'Getting started', projects)
  const acmeItems = await call('GET', '/work-items', { token: S })
  check('Acme member sees the seeded items', acmeItems.data.length >= 10, acmeItems.data.length)
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
  check('member cannot invite → 403', (await call('POST', '/members', { token: S, body: { fullName: 'x', email: 'x@x.io', roleId: acmeWs.data.roles.find((r) => r.slug === 'member')?.id } })).status === 403)
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
  const roleId = (slug) => ws.data.roles.find((r) => r.slug === slug)?.id
  const invite = await call('POST', '/members', { token: T, body: { fullName: 'New Person', email: `invitee-${Date.now()}@example.com`, roleId: roleId('admin') } })
  check('invite member → 201 with Member and an invite link', invite.status === 201 && invite.data.role === 'admin' && /accept-invite/.test(invite.data.inviteLink), invite)
  const invitedLogin = await call('POST', '/auth/login', { body: { email: invite.data.email, password: 'password123' } })
  check('invited member cannot log in before accepting', invitedLogin.status === 401)
  check('remove member → 204', (await call('DELETE', `/members/${invite.data.id}`, { token: T })).status === 204)
  check('cannot remove the owner/yourself → 400', (await call('DELETE', `/members/${owner.data.user.id}`, { token: T })).status === 400)
  const proj = await call('POST', '/projects', { token: T, body: { name: 'Second', description: '' } })
  check('create project → 201', proj.status === 201, proj)
  check('update project → 200', (await call('PUT', `/projects/${proj.data.id}`, { token: T, body: { name: 'Second!', description: 'x' } })).data?.name === 'Second!')
  check('delete project → 204', (await call('DELETE', `/projects/${proj.data.id}`, { token: T })).status === 204)

  console.info('\nRoles & permissions')
  check('sessions carry role name and permissions', owner.data.permissions?.includes('roles.manage') && owner.data.roleName === 'Owner', owner.data)
  check('member session has only member permissions', sarah.data.permissions.join() === 'bugs.report,tasks.create', sarah.data.permissions)
  const admin = await call('POST', '/auth/login', { body: { email: 'admin@acme.com', password: 'Admin@12345' } })
  check('seeded admin admin@acme.com logs in with role admin', admin.status === 200 && admin.data.role === 'admin', admin)
  const mgr = await call('POST', '/auth/login', { body: { email: 'manager@acme.com', password: 'Manager@12345' } })
  check('seeded manager manager@acme.com logs in as Project Manager', mgr.status === 200 && mgr.data.role === 'manager', mgr)
  const demo = await call('GET', '/auth/demo-accounts')
  check('login page gets the one-click accounts', demo.status === 200 && demo.data.some((a) => a.email === 'admin@acme.com'), demo)
  check('member cannot list roles → 403', (await call('GET', '/roles', { token: S })).status === 403)
  check('manager cannot list roles → 403', (await call('GET', '/roles', { token: mgr.data.token })).status === 403)
  check(
    'manager cannot add members → 403',
    (await call('POST', '/members', { token: mgr.data.token, body: { fullName: 'x', email: 'y@x.io', roleId: roleId('member') } })).status === 403,
  )
  const perms = await call('GET', '/permissions', { token: T })
  check('permission catalog lists 19 permissions', perms.status === 200 && perms.data.length === 19, perms.data?.length)
  const rolesList = await call('GET', '/roles', { token: T })
  check('new org has owner/admin/manager/member roles', rolesList.data.map((r) => r.slug).join() === 'owner,admin,manager,member', rolesList.data)
  check('owner role cannot be edited → 400', (await call('PUT', `/roles/${roleId('owner')}`, { token: T, body: { name: 'Boss', permissions: [] } })).status === 400)
  check('built-in role cannot be deleted → 400', (await call('DELETE', `/roles/${roleId('member')}`, { token: T })).status === 400)
  const qaBody = { name: 'QA Lead', description: 'Sees everything', permissions: ['projects.view_all', 'tasks.view_all'] }
  const bogus = await call('POST', '/roles', { token: T, body: { ...qaBody, permissions: ['bogus'] } })
  check('unknown permission → 400', bogus.status === 400, bogus)
  const qa = await call('POST', '/roles', { token: T, body: qaBody })
  check('create custom role → 201', qa.status === 201 && qa.data.slug === 'qa-lead' && qa.data.permissions.length === 2, qa)
  const qaEmail = `qa-${stamp}@example.com`
  const added = await call('POST', '/members', { token: T, body: { fullName: 'Quinn QA', email: qaEmail, roleId: qa.data.id, password: 'quinn-pass-1' } })
  check('admin adds a member with a password → active right away', added.status === 201 && added.data.activated === true && !added.data.inviteLink, added)
  const qaLogin = await call('POST', '/auth/login', { body: { email: qaEmail, password: 'quinn-pass-1' } })
  check('the added member logs in with their role', qaLogin.status === 200 && qaLogin.data.role === 'qa-lead', qaLogin)
  const Q = qaLogin.data.token
  const allProjects = (await call('GET', '/projects', { token: T })).data.length
  check('custom role sees all projects (projects.view_all)', (await call('GET', '/projects', { token: Q })).data.length === allProjects)
  const noCreate = await call('POST', '/work-items', { token: Q, body: { projectId: 'x', title: 'x', statusId: 'x', priority: 'low', customValues: {} } })
  check('custom role cannot create tasks (no tasks.create) → 403', noCreate.status === 403, noCreate)
  check('custom role in use cannot be deleted → 400', (await call('DELETE', `/roles/${qa.data.id}`, { token: T })).status === 400)
  const grant = await call('PUT', `/roles/${qa.data.id}`, { token: T, body: { ...qaBody, permissions: [...qaBody.permissions, 'projects.create'] } })
  check('edit role permissions → 200', grant.status === 200 && grant.data.permissions.includes('projects.create'), grant)
  const qaProject = await call('POST', '/projects', { token: Q, body: { name: 'QA project', description: '' } })
  check('new permission applies on the very next request', qaProject.status === 201, qaProject)
  const me = await call('GET', '/auth/me', { token: Q })
  check('/auth/me returns fresh permissions', me.data.permissions?.includes('projects.create'), me.data)
  check('change member role → 200', (await call('PUT', `/members/${added.data.id}/role`, { token: T, body: { roleId: roleId('member') } })).status === 200)
  check('role change applies immediately', (await call('POST', '/projects', { token: Q, body: { name: 'nope', description: '' } })).status === 403)
  check('cannot give the owner role → 400', (await call('PUT', `/members/${added.data.id}/role`, { token: T, body: { roleId: roleId('owner') } })).status === 400)
  check('cannot change your own role → 400', (await call('PUT', `/members/${owner.data.user.id}/role`, { token: T, body: { roleId: roleId('member') } })).status === 400)
  check('remove added member → 204', (await call('DELETE', `/members/${added.data.id}`, { token: T })).status === 204)
  check('delete unused custom role → 204', (await call('DELETE', `/roles/${qa.data.id}`, { token: T })).status === 204)

  console.info('\nBugs')
  const memberRole = roleId('member')
  const addMember = async (name) => {
    const mail = `${name.toLowerCase()}-${stamp}@example.com`
    const res = await call('POST', '/members', { token: T, body: { fullName: name, email: mail, roleId: memberRole, password: 'bug-pass-123' } })
    const login = await call('POST', '/auth/login', { body: { email: mail, password: 'bug-pass-123' } })
    return { id: res.data.id, token: login.data.token }
  }
  const M = await addMember('Rita')
  const N = await addMember('Nick')
  const sample = (await call('GET', '/projects', { token: T })).data.find((p) => p.name === 'Getting started')
  const firstStatus = (await call('GET', '/workspace', { token: T })).data.statuses[0].id
  // Rita gets a task in the sample project, so she can see that project.
  await call('POST', '/work-items', { token: T, body: { projectId: sample.id, title: 'Rita task', statusId: firstStatus, assigneeId: M.id } })

  check('no bugs yet', (await call('GET', '/bugs', { token: T })).data.length === 0)
  const bugBody = { projectId: sample.id, title: 'Save button broken', stepsToReproduce: '1. Click save', severity: 'major' }
  check('member cannot assign while reporting → 403', (await call('POST', '/bugs', { token: M.token, body: { ...bugBody, assigneeId: M.id } })).status === 403)
  const bug = await call('POST', '/bugs', { token: M.token, body: bugBody })
  check('member reports a bug → 201 BUG-1, open', bug.status === 201 && bug.data.key === 'BUG-1' && bug.data.status === 'open' && bug.data.reporterId === M.id, bug)
  const bug2 = await call('POST', '/bugs', { token: T, body: { ...bugBody, title: 'Second bug' } })
  check('numbers count up per organization (BUG-2)', bug2.data.key === 'BUG-2', bug2.data)
  check('reporter cannot change priority → 403', (await call('PATCH', `/bugs/${bug.data.id}`, { token: M.token, body: { priority: 'high' } })).status === 403)
  check('reporter edits the title → 200', (await call('PATCH', `/bugs/${bug.data.id}`, { token: M.token, body: { title: 'Save button does nothing' } })).data?.title === 'Save button does nothing')
  const assigned = await call('PATCH', `/bugs/${bug.data.id}`, { token: T, body: { assigneeId: M.id, priority: 'high' } })
  check('triager assigns and prioritizes → 200', assigned.data?.assigneeId === M.id && assigned.data.priority === 'high', assigned)
  check('a member who cannot see the project gets 404', (await call('GET', `/bugs/${bug.data.id}`, { token: N.token })).status === 404)
  check("…and it is not in that member's list", !(await call('GET', '/bugs', { token: N.token })).data.some((b) => b.id === bug.data.id))
  check('that member cannot change it → 404', (await call('PATCH', `/bugs/${bug.data.id}`, { token: N.token, body: { status: 'closed' } })).status === 404)
  const otherProject = await call('POST', '/projects', { token: T, body: { name: 'Other', description: '' } })
  const otherTask = await call('POST', '/work-items', { token: T, body: { projectId: otherProject.data.id, title: 'x', statusId: firstStatus } })
  check('linking a task from another project → 400', (await call('PATCH', `/bugs/${bug.data.id}`, { token: T, body: { workItemId: otherTask.data.id } })).status === 400)
  const resolved = await call('PATCH', `/bugs/${bug.data.id}`, { token: M.token, body: { status: 'resolved' } })
  check('assignee resolves → resolution defaults to fixed', resolved.data?.status === 'resolved' && resolved.data.resolution === 'fixed' && !!resolved.data.resolvedAt, resolved)
  const comment = await call('POST', `/bugs/${bug.data.id}/comments`, { token: M.token, body: { body: 'Fixed in the latest build.' } })
  check('comment → 201', comment.status === 201 && comment.data.kind === 'comment' && comment.data.authorName === 'Rita', comment)
  const reopened = await call('PATCH', `/bugs/${bug.data.id}`, { token: T, body: { status: 'open' } })
  check('reopen clears the resolution', reopened.data?.status === 'open' && reopened.data.resolution === null && reopened.data.resolvedAt === null, reopened)
  const detail = await call('GET', `/bugs/${bug.data.id}`, { token: T })
  const log = detail.data.comments.filter((c) => c.kind === 'event').map((c) => c.body)
  check(
    'activity log records the changes',
    log[0] === 'reported this bug' && log.includes('assigned this bug to Rita') && log.includes('marked this Resolved (Fixed)') && log.includes('reopened this bug'),
    log,
  )
  check('list shows the comment count', (await call('GET', '/bugs', { token: T })).data.find((b) => b.id === bug.data.id)?.commentCount === 1)
  await call('PATCH', `/bugs/${bug.data.id}`, { token: T, body: { status: 'closed', resolution: 'duplicate' } })
  check('reporter cannot delete a closed bug → 403', (await call('DELETE', `/bugs/${bug.data.id}`, { token: M.token })).status === 403)
  check('triager deletes it → 204', (await call('DELETE', `/bugs/${bug.data.id}`, { token: T })).status === 204)
  check('unknown severity → 400', (await call('POST', '/bugs', { token: T, body: { ...bugBody, severity: 'huge' } })).status === 400)

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
