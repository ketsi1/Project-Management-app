// ---------------------------------------------------------------------------
// MOCK BACKEND
// A pretend server that keeps all data in the browser's localStorage.
// It lets you use the whole app before the Express + MySQL backend exists.
// Delete nothing here when the real backend is ready: just set VITE_API_URL
// in the .env file and the app switches to httpApi automatically.
// ---------------------------------------------------------------------------
import type {
  Bug,
  BugComment,
  BugStatus,
  CustomField,
  Member,
  Organization,
  Permission,
  PermissionInfo,
  Project,
  Role,
  RoleDetail,
  Session,
  Status,
  Terminology,
  WorkItem,
} from '../types'
import type { ApiClient } from './ApiClient'
import { ApiError } from './ApiError'
import { getStoredSession } from './session'

// --- Roles (fixed in the mock; the real backend lets admins edit them) -------

const ALL_PERMISSIONS: PermissionInfo[] = [
  { key: 'organization.update', group: 'Organization', name: 'Edit organization', description: 'Change the organization name and terminology.' },
  { key: 'statuses.manage', group: 'Organization', name: 'Manage statuses', description: 'Add, rename, reorder and delete board columns.' },
  { key: 'fields.manage', group: 'Organization', name: 'Manage custom fields', description: 'Add and delete custom fields on tasks.' },
  { key: 'members.view', group: 'Members', name: 'View team', description: 'See the team page with everyone’s workload.' },
  { key: 'members.create', group: 'Members', name: 'Add members', description: 'Create accounts and send invitations.' },
  { key: 'members.approve', group: 'Members', name: 'Approve sign-ups', description: 'Approve or reject people who signed up themselves.' },
  { key: 'members.update_role', group: 'Members', name: 'Change member roles', description: 'Give a member a different role.' },
  { key: 'members.remove', group: 'Members', name: 'Remove members', description: 'Remove people from the organization.' },
  { key: 'roles.manage', group: 'Members', name: 'Manage roles', description: 'Create, edit and delete roles and their permissions.' },
  { key: 'projects.view_all', group: 'Projects', name: 'See all projects', description: 'Without this, a person only sees projects that have work assigned to them.' },
  { key: 'projects.create', group: 'Projects', name: 'Create projects', description: 'Start new projects.' },
  { key: 'projects.update', group: 'Projects', name: 'Edit projects', description: 'Rename projects and change their description.' },
  { key: 'projects.delete', group: 'Projects', name: 'Delete projects', description: 'Delete projects and all their tasks.' },
  { key: 'tasks.view_all', group: 'Tasks', name: 'See all tasks', description: 'See everyone’s tasks and the team dashboard, not just your own.' },
  { key: 'tasks.create', group: 'Tasks', name: 'Create tasks', description: 'Add tasks to projects they can see.' },
  { key: 'tasks.manage_all', group: 'Tasks', name: 'Edit any task', description: 'Edit and delete any task.' },
  { key: 'bugs.report', group: 'Bugs', name: 'Report bugs', description: 'Report new bugs. Anyone who can see a bug can comment on it.' },
  { key: 'bugs.view_all', group: 'Bugs', name: 'See all bugs', description: 'See every bug, not only ones you reported, are assigned or can see the project of.' },
  { key: 'bugs.manage', group: 'Bugs', name: 'Triage bugs', description: 'Assign, prioritize, edit, resolve and delete any bug.' },
]
const EVERYTHING = ALL_PERMISSIONS.map((p) => p.key)

const MOCK_ROLES: RoleDetail[] = [
  { id: 'role-owner', slug: 'owner', name: 'Owner', description: 'Full control of the organization.', isSystem: true, locked: true, permissions: EVERYTHING, memberCount: 0 },
  { id: 'role-admin', slug: 'admin', name: 'Admin', description: 'Runs the workspace: people, roles, settings, projects and all tasks.', isSystem: true, locked: false, permissions: EVERYTHING, memberCount: 0 },
  {
    id: 'role-manager',
    slug: 'manager',
    name: 'Project Manager',
    description: 'Plans projects and manages everyone’s tasks, but not people or settings.',
    isSystem: false,
    locked: false,
    permissions: ['members.view', 'projects.view_all', 'projects.create', 'projects.update', 'tasks.view_all', 'tasks.create', 'tasks.manage_all', 'bugs.report', 'bugs.view_all', 'bugs.manage'],
    memberCount: 0,
  },
  { id: 'role-member', slug: 'member', name: 'Member', description: 'Works on the tasks assigned to them and can add their own.', isSystem: true, locked: false, permissions: ['tasks.create', 'bugs.report'], memberCount: 0 },
]

const roleBySlug = (slug: Role) => MOCK_ROLES.find((r) => r.slug === slug) ?? MOCK_ROLES[MOCK_ROLES.length - 1]

const MOCK_ONLY = 'Editing roles needs the real backend. Set VITE_API_URL in .env and run it.'

// --- Shape of the fake database -------------------------------------------

interface StoredUser {
  id: string
  fullName: string
  email: string
  passwordHash: string
  organizationId: string
  role: Role
  // 'pending' = signed up, waiting for a manager. Missing means active.
  status?: 'pending' | 'active'
}

const PENDING_MESSAGE = 'Your account is waiting for a manager to approve it. You can log in once it is approved.'

interface StoredOrganization {
  organization: Organization
  terminology: Terminology
  statuses: Status[]
  fields: CustomField[]
  projects: Project[]
  workItems: WorkItem[]
  // Added later: missing in data saved by older versions of the demo.
  bugs?: Bug[]
  bugComments?: Array<BugComment & { bugId: string }>
}

interface Database {
  users: StoredUser[]
  organizations: StoredOrganization[]
}

// v4: tasks remember who created them (employees may only edit/delete their own).
// The new key makes browsers that saved the old demo data load the new data.
const DB_KEY = 'pm-mock-db-v4'

// Password hash for 'password123' (SHA-256), used by members invited in the mock.
const DEFAULT_PASSWORD_HASH = 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f'

function getInitialDatabase(): Database {
  const orgId = 'org-acme-default'
  const alexId = 'user-alex-boss'
  const sarahId = 'user-sarah-dev'
  const davidId = 'user-david-dev'

  const statuses: Status[] = [
    { id: 'status-todo', name: 'To do', category: 'not_started', color: '#94a3b8', position: 0 },
    { id: 'status-in-progress', name: 'In progress', category: 'active', color: '#3b82f6', position: 1 },
    { id: 'status-in-review', name: 'In review', category: 'active', color: '#f59e0b', position: 2 },
    { id: 'status-done', name: 'Done', category: 'done', color: '#22c55e', position: 3 },
  ]

  const project1: Project = {
    id: 'proj-web-redesign',
    name: 'Website Redesign & Launch',
    description: 'Modernize marketing site, design new dashboard experience and deploy to production.',
    createdAt: now(),
  }

  const project2: Project = {
    id: 'proj-mobile-app',
    name: 'Mobile App MVP',
    description: 'Native iOS and Android client for on-the-go project tracking and real-time alerts.',
    createdAt: now(),
  }

  const daysOffset = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10)

  const workItems: WorkItem[] = [
    // Project 1 tasks
    {
      id: 'task-1',
      projectId: project1.id,
      title: 'Design responsive mockups & component tokens',
      description: 'Create high-fidelity Figma screens for both desktop and mobile breakpoints.',
      statusId: 'status-in-progress',
      priority: 'high',
      assigneeId: davidId,
      dueDate: daysOffset(3),
      customValues: { 'field-department': 'Design', 'field-est-hours': '16' },
      createdById: alexId,
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: 'task-2',
      projectId: project1.id,
      title: 'Build interactive Employee Workstation view',
      description: 'Implement personal task queue, daily focus mode, and 1-click status transitions.',
      statusId: 'status-in-progress',
      priority: 'urgent',
      assigneeId: sarahId,
      dueDate: daysOffset(2),
      customValues: { 'field-department': 'Engineering', 'field-est-hours': '20' },
      createdById: alexId,
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: 'task-3',
      projectId: project1.id,
      title: 'Executive Manager Command Center & Team Matrix',
      description: 'Provide portfolio health metrics, team capacity distribution, and project controls.',
      statusId: 'status-done',
      priority: 'high',
      assigneeId: sarahId,
      dueDate: daysOffset(-1),
      customValues: { 'field-department': 'Engineering', 'field-est-hours': '18' },
      createdById: alexId,
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: 'task-4',
      projectId: project1.id,
      title: 'Review project milestones & budget with stakeholders',
      description: 'Executive quarterly sync to approve budget allocation and Q4 roadmap.',
      statusId: 'status-in-review',
      priority: 'high',
      assigneeId: alexId,
      dueDate: daysOffset(5),
      customValues: { 'field-department': 'Management', 'field-est-hours': '6' },
      createdById: alexId,
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: 'task-5',
      projectId: project1.id,
      title: 'Set up automated CI/CD deployment pipeline',
      description: 'Configure GitHub Actions test suite and automated staging deploy.',
      statusId: 'status-todo',
      priority: 'medium',
      assigneeId: sarahId,
      dueDate: daysOffset(7),
      customValues: { 'field-department': 'Engineering', 'field-est-hours': '12' },
      createdById: alexId,
      createdAt: now(),
      updatedAt: now(),
    },

    // Project 2 tasks
    {
      id: 'task-6',
      projectId: project2.id,
      title: 'Mobile app user onboarding wireframes & flows',
      description: 'Design step-by-step account activation and workspace creation flow for phone screens.',
      statusId: 'status-done',
      priority: 'high',
      assigneeId: davidId,
      dueDate: daysOffset(-2),
      customValues: { 'field-department': 'Design', 'field-est-hours': '14' },
      createdById: alexId,
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: 'task-7',
      projectId: project2.id,
      title: 'Implement push notification service integration',
      description: 'Send instant notifications when task status changes or when a user is assigned work.',
      statusId: 'status-todo',
      priority: 'medium',
      assigneeId: sarahId,
      dueDate: daysOffset(4),
      customValues: { 'field-department': 'Engineering', 'field-est-hours': '15' },
      createdById: alexId,
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: 'task-8',
      projectId: project2.id,
      title: 'Team sprint capacity allocation & project plan',
      description: 'Align cross-functional team bandwidth for mobile MVP release.',
      statusId: 'status-in-progress',
      priority: 'high',
      assigneeId: alexId,
      dueDate: daysOffset(1),
      customValues: { 'field-department': 'Management', 'field-est-hours': '8' },
      createdById: alexId,
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: 'task-9',
      projectId: project2.id,
      title: 'Design dark mode palette and icon set',
      description: 'Ensure contrast compliance for WCAG AAA and export SVG icon assets.',
      statusId: 'status-in-review',
      priority: 'low',
      assigneeId: davidId,
      dueDate: daysOffset(6),
      customValues: { 'field-department': 'Design', 'field-est-hours': '10' },
      createdById: alexId,
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: 'task-10',
      projectId: project2.id,
      title: 'Conduct sprint retrospective & team feedback',
      description: 'Collect feedback on velocity and process improvements.',
      statusId: 'status-todo',
      priority: 'low',
      assigneeId: alexId,
      dueDate: daysOffset(8),
      customValues: { 'field-department': 'Management', 'field-est-hours': '4' },
      createdById: alexId,
      createdAt: now(),
      updatedAt: now(),
    },
  ]

  const users: StoredUser[] = [
    {
      id: alexId,
      fullName: 'Alex Morgan',
      email: 'alex@acme.com',
      passwordHash: 'e24df920078c3dd4e7e8d2442f00e5c9ab2a231bb3918d65cc50906e49ecaef4', // 87654321
      organizationId: orgId,
      role: 'owner',
    },
    {
      id: sarahId,
      fullName: 'Sarah Connor',
      email: 'sarah@acme.com',
      passwordHash: 'ef797c8118f02dfb649607dd5d3f8c7623048c9c063d532cc95c5ed7a898a64f', // 12345678
      organizationId: orgId,
      role: 'member',
    },
    {
      id: davidId,
      fullName: 'David Kim',
      email: 'david@acme.com',
      passwordHash: 'c7be1876fbf200269cbac72494aa5e8e3827814a3c9759221e65eb22974d22de', // 21345678
      organizationId: orgId,
      role: 'member',
    },
  ]

  const org: StoredOrganization = {
    organization: { id: orgId, name: 'Acme Corp' },
    terminology: { project: 'Project', projects: 'Projects', task: 'Task', tasks: 'Tasks' },
    statuses,
    fields: [
      { id: 'field-department', label: 'Department', type: 'select', options: ['Engineering', 'Design', 'Management', 'QA'] },
      { id: 'field-est-hours', label: 'Est. Hours', type: 'number', options: [] },
    ],
    projects: [project1, project2],
    workItems,
  }

  return { users, organizations: [org] }
}

function loadDb(): Database {
  const raw = localStorage.getItem(DB_KEY)
  if (!raw) {
    const initial = getInitialDatabase()
    saveDb(initial)
    return initial
  }
  try {
    const parsed = JSON.parse(raw) as Database
    if (!parsed.users || parsed.users.length === 0) {
      const initial = getInitialDatabase()
      saveDb(initial)
      return initial
    }
    return parsed
  } catch {
    const initial = getInitialDatabase()
    saveDb(initial)
    return initial
  }
}

function saveDb(db: Database): void {
  localStorage.setItem(DB_KEY, JSON.stringify(db))
}

function newId(): string {
  return crypto.randomUUID()
}

function now(): string {
  return new Date().toISOString()
}

// Waits a little so the app behaves like it is talking to a real server.
function delay(ms = 250): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Hashes a password with SHA-256 so it is not stored as plain text.
async function hashPassword(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(password)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

// Finds the organization of whoever is logged in, like a server would from the token.
function currentOrg(db: Database): StoredOrganization {
  const session = getStoredSession()
  if (!session) throw new ApiError('Please log in again.', 401)
  const org = db.organizations.find((o) => o.organization.id === session.organization.id)
  if (!org) throw new ApiError('Organization not found.', 404)
  return org
}

// Same idea as the backend: the role decides the permissions.
function sessionCan(permission: Permission): boolean {
  const session = getStoredSession()
  return !!session && roleBySlug(session.role).permissions.includes(permission)
}

function requirePermission(permission: Permission): void {
  if (!sessionCan(permission)) throw new ApiError('Your role does not allow this.', 403)
}

const seesAllProjects = () => sessionCan('projects.view_all')

// --- Bugs: same rules as the backend's bugService ---------------------------------

const BUG_STATUS_LABELS: Record<BugStatus, string> = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed' }

function orgBugs(org: StoredOrganization) {
  org.bugs ??= []
  org.bugComments ??= []
  return { bugs: org.bugs, comments: org.bugComments }
}

function canSeeBug(org: StoredOrganization, bug: Bug): boolean {
  const userId = getStoredSession()?.user.id
  if (sessionCan('bugs.view_all') || seesAllProjects()) return true
  if (bug.reporterId === userId || bug.assigneeId === userId) return true
  return visibleProjectIds(org)?.has(bug.projectId) ?? true
}

function findVisibleBug(org: StoredOrganization, id: string): Bug {
  const bug = orgBugs(org).bugs.find((b) => b.id === id)
  if (!bug || !canSeeBug(org, bug)) throw new ApiError('Bug not found.', 404)
  return bug
}

function withCommentCount(org: StoredOrganization, bug: Bug): Bug {
  return { ...bug, commentCount: orgBugs(org).comments.filter((c) => c.bugId === bug.id && c.kind === 'comment').length }
}

function logBugEvent(org: StoredOrganization, bugId: string, body: string, kind: 'event' | 'comment' = 'event'): BugComment & { bugId: string } {
  const session = getStoredSession()
  const entry = { id: newId(), bugId, kind, authorId: session?.user.id ?? null, authorName: session?.user.fullName ?? null, body, createdAt: now() }
  orgBugs(org).comments.push(entry)
  return entry
}
const managesAllTasks = () => sessionCan('tasks.manage_all')

// Same rule as the real backend: managers see every project, employees only projects
// where at least one task is assigned to them.
function visibleProjectIds(org: StoredOrganization): Set<string> | null {
  if (seesAllProjects()) return null
  const userId = getStoredSession()?.user.id
  return new Set(org.workItems.filter((w) => w.assigneeId === userId).map((w) => w.projectId))
}

function toSession(user: StoredUser, organization: Organization): Session {
  return {
    token: `mock-${user.id}`,
    user: { id: user.id, fullName: user.fullName, email: user.email },
    organization,
    role: user.role,
    roleName: roleBySlug(user.role).name,
    permissions: roleBySlug(user.role).permissions,
  }
}

function toMember(u: StoredUser): Member {
  const role = roleBySlug(u.role)
  return { id: u.id, fullName: u.fullName, email: u.email, role: role.slug, roleId: role.id, roleName: role.name, activated: true }
}

// --- The mock API itself ---------------------------------------------------

export const mockApi: ApiClient = {
  // Sign-up joins an existing organization as a pending employee and does NOT log in.
  async register(input) {
    await delay()
    const db = loadDb()
    const email = input.email.trim().toLowerCase()
    if (db.users.some((u) => u.email === email)) {
      throw new ApiError('An account with this email already exists.', 409)
    }
    const wanted = input.organizationName.trim().toLowerCase()
    const org = db.organizations.find((o) => o.organization.name.toLowerCase() === wanted)
    if (!org) {
      throw new ApiError('No organization with that name. Ask your manager for the exact organization name.', 404)
    }
    db.users.push({
      id: newId(),
      fullName: input.fullName.trim(),
      email,
      passwordHash: await hashPassword(input.password),
      organizationId: org.organization.id,
      role: 'member',
      status: 'pending',
    })
    saveDb(db)
    return { pending: true, message: PENDING_MESSAGE }
  },

  async login(input) {
    await delay()
    const db = loadDb()
    const email = input.email.trim().toLowerCase()
    const user = db.users.find((u) => u.email === email)
    const hash = await hashPassword(input.password)
    // Same message for "no such user" and "wrong password" so attackers learn nothing.
    if (!user || !user.passwordHash || user.passwordHash !== hash) {
      throw new ApiError('Email or password is incorrect.', 401)
    }
    // Checked after the password, so strangers cannot probe which emails are pending.
    if (user.status === 'pending') throw new ApiError(PENDING_MESSAGE, 403)
    const org = db.organizations.find((o) => o.organization.id === user.organizationId)
    if (!org) throw new ApiError('Organization not found.', 404)
    return toSession(user, org.organization)
  },

  async logout() {
    await delay(50)
  },

  async me() {
    const session = getStoredSession()
    const user = session && loadDb().users.find((u) => u.id === session.user.id)
    if (!user) throw new ApiError('Please log in again.', 401)
    const { token: _token, organization: _organization, ...info } = toSession(user, session.organization)
    return info
  },

  async acceptInvite() {
    throw new ApiError('Invitation links need the real backend. In the demo, invited people log in with password123.')
  },

  async demoAccounts() {
    return [
      { fullName: 'Alex Morgan', email: 'alex@acme.com', password: '87654321', role: 'owner', roleName: 'Owner' },
      { fullName: 'Sarah Connor', email: 'sarah@acme.com', password: '12345678', role: 'member', roleName: 'Member' },
      { fullName: 'David Kim', email: 'david@acme.com', password: '21345678', role: 'member', roleName: 'Member' },
    ]
  },

  async getWorkspace() {
    await delay()
    const db = loadDb()
    const org = currentOrg(db)
    const inOrg = db.users.filter((u) => u.organizationId === org.organization.id)
    const canApprove = sessionCan('members.approve')
    return {
      organization: org.organization,
      terminology: org.terminology,
      statuses: [...org.statuses].sort((a, b) => a.position - b.position),
      fields: org.fields,
      members: inOrg.filter((u) => u.status !== 'pending').map(toMember),
      pendingMembers: canApprove ? inOrg.filter((u) => u.status === 'pending').map(toMember) : [],
      roles: MOCK_ROLES.map(({ id, slug, name }) => ({ id, slug, name })),
    }
  },

  async updateOrganization(name, terminology) {
    await delay()
    requirePermission('organization.update')
    const db = loadDb()
    const org = currentOrg(db)
    org.organization.name = name
    org.terminology = terminology
    saveDb(db)
  },

  async createStatus(input) {
    await delay()
    requirePermission('statuses.manage')
    const db = loadDb()
    const org = currentOrg(db)
    const status: Status = { ...input, id: newId() }
    org.statuses.push(status)
    saveDb(db)
    return status
  },

  async updateStatus(id, input) {
    await delay()
    requirePermission('statuses.manage')
    const db = loadDb()
    const org = currentOrg(db)
    const index = org.statuses.findIndex((s) => s.id === id)
    if (index === -1) throw new ApiError('Status not found.', 404)
    org.statuses[index] = { ...input, id }
    saveDb(db)
    return org.statuses[index]
  },

  async deleteStatus(id, moveToStatusId) {
    await delay()
    requirePermission('statuses.manage')
    const db = loadDb()
    const org = currentOrg(db)
    if (org.statuses.length <= 1) throw new ApiError('You need at least one status.')
    if (!org.statuses.some((s) => s.id === moveToStatusId) || moveToStatusId === id) {
      throw new ApiError('Choose another status to move the items to.')
    }
    org.workItems.forEach((item) => {
      if (item.statusId === id) item.statusId = moveToStatusId
    })
    org.statuses = org.statuses.filter((s) => s.id !== id)
    saveDb(db)
  },

  async createField(input) {
    await delay()
    requirePermission('fields.manage')
    const db = loadDb()
    const org = currentOrg(db)
    const field: CustomField = { ...input, id: newId() }
    org.fields.push(field)
    saveDb(db)
    return field
  },

  async deleteField(id) {
    await delay()
    requirePermission('fields.manage')
    const db = loadDb()
    const org = currentOrg(db)
    org.fields = org.fields.filter((f) => f.id !== id)
    saveDb(db)
  },

  async inviteMember(input) {
    await delay()
    requirePermission('members.create')
    const db = loadDb()
    const org = currentOrg(db)
    const email = input.email.trim().toLowerCase()
    if (db.users.some((u) => u.email === email)) {
      throw new ApiError('This email already has an account.', 409)
    }
    const role = MOCK_ROLES.find((r) => r.id === input.roleId)
    if (!role || role.slug === 'owner') throw new ApiError('Choose a valid role.')
    // In the mock, invited members without a password can log in with password123.
    const user: StoredUser = {
      id: newId(),
      fullName: input.fullName.trim(),
      email,
      passwordHash: input.password ? await hashPassword(input.password) : DEFAULT_PASSWORD_HASH,
      organizationId: org.organization.id,
      role: role.slug,
    }
    db.users.push(user)
    saveDb(db)
    return toMember(user)
  },

  async updateMemberRole(id, roleId) {
    await delay()
    requirePermission('members.update_role')
    const db = loadDb()
    const org = currentOrg(db)
    const user = db.users.find((u) => u.id === id && u.organizationId === org.organization.id)
    const role = MOCK_ROLES.find((r) => r.id === roleId)
    if (!user) throw new ApiError('Member not found.', 404)
    if (!role || role.slug === 'owner') throw new ApiError('Choose a valid role.')
    if (user.role === 'owner') throw new ApiError('The owner cannot be changed.')
    if (user.id === getStoredSession()?.user.id) throw new ApiError('You cannot change yourself.')
    user.role = role.slug
    saveDb(db)
  },

  async listPermissions() {
    requirePermission('roles.manage')
    return ALL_PERMISSIONS
  },

  async listRoles() {
    requirePermission('roles.manage')
    const users = loadDb().users
    return MOCK_ROLES.map((r) => ({ ...r, memberCount: users.filter((u) => u.role === r.slug).length }))
  },

  async createRole() {
    throw new ApiError(MOCK_ONLY)
  },

  async updateRole() {
    throw new ApiError(MOCK_ONLY)
  },

  async deleteRole() {
    throw new ApiError(MOCK_ONLY)
  },

  async approveMember(id) {
    await delay()
    requirePermission('members.approve')
    const db = loadDb()
    const org = currentOrg(db)
    const user = db.users.find((u) => u.id === id && u.organizationId === org.organization.id && u.status === 'pending')
    if (!user) throw new ApiError('No pending sign-up found for this person.', 404)
    user.status = 'active'
    saveDb(db)
  },

  async removeMember(id) {
    await delay()
    requirePermission('members.remove')
    const db = loadDb()
    const org = currentOrg(db)
    const user = db.users.find((u) => u.id === id && u.organizationId === org.organization.id)
    if (!user) throw new ApiError('Member not found.', 404)
    if (user.role === 'owner') throw new ApiError('The owner cannot be removed.')
    db.users = db.users.filter((u) => u.id !== id)
    org.workItems.forEach((item) => {
      if (item.assigneeId === id) item.assigneeId = null
    })
    saveDb(db)
  },

  async listProjects() {
    await delay()
    const org = currentOrg(loadDb())
    const visible = visibleProjectIds(org)
    return visible ? org.projects.filter((p) => visible.has(p.id)) : org.projects
  },

  async createProject(input) {
    await delay()
    requirePermission('projects.create')
    const db = loadDb()
    const org = currentOrg(db)
    const project: Project = { ...input, id: newId(), createdAt: now() }
    org.projects.push(project)
    saveDb(db)
    return project
  },

  async updateProject(id, input) {
    await delay()
    requirePermission('projects.update')
    const db = loadDb()
    const org = currentOrg(db)
    const project = org.projects.find((p) => p.id === id)
    if (!project) throw new ApiError('Project not found.', 404)
    project.name = input.name
    project.description = input.description
    saveDb(db)
    return project
  },

  async deleteProject(id) {
    await delay()
    requirePermission('projects.delete')
    const db = loadDb()
    const org = currentOrg(db)
    org.projects = org.projects.filter((p) => p.id !== id)
    org.workItems = org.workItems.filter((w) => w.projectId !== id)
    saveDb(db)
  },

  async listWorkItems(projectId) {
    await delay()
    const org = currentOrg(loadDb())
    const visible = visibleProjectIds(org)
    if (projectId && visible && !visible.has(projectId)) throw new ApiError('Project not found.', 404)
    return org.workItems.filter((w) => (!projectId || w.projectId === projectId) && (!visible || visible.has(w.projectId)))
  },

  async createWorkItem(input) {
    await delay()
    requirePermission('tasks.create')
    const db = loadDb()
    const org = currentOrg(db)
    if (!input.title.trim()) throw new ApiError('Title is required.')
    const visible = visibleProjectIds(org)
    if (visible && !visible.has(input.projectId)) throw new ApiError('Choose a valid project.')
    const createdById = getStoredSession()?.user.id ?? null
    const item: WorkItem = { ...input, id: newId(), createdById, createdAt: now(), updatedAt: now() }
    org.workItems.push(item)
    saveDb(db)
    return item
  },

  async updateWorkItem(id, changes) {
    await delay(150)
    const db = loadDb()
    const org = currentOrg(db)
    const index = org.workItems.findIndex((w) => w.id === id)
    if (index === -1) throw new ApiError('Item not found.', 404)
    const current = org.workItems[index]
    const userId = getStoredSession()?.user.id
    // Employees: full edits on their own tasks; on others only the status of a task assigned to them.
    if (!managesAllTasks() && current.createdById !== userId) {
      const changed = (Object.keys(changes) as Array<keyof typeof changes>).filter(
        (key) => JSON.stringify(changes[key] ?? null) !== JSON.stringify(current[key] ?? null),
      )
      if (current.assigneeId !== userId) throw new ApiError('You can only update tasks assigned to you.', 403)
      if (changed.some((key) => key !== 'statusId')) {
        throw new ApiError('You can only change the status of a task a manager created.', 403)
      }
    }
    org.workItems[index] = { ...current, ...changes, updatedAt: now() }
    saveDb(db)
    return org.workItems[index]
  },

  async listBugs(projectId) {
    await delay()
    const org = currentOrg(loadDb())
    return orgBugs(org)
      .bugs.filter((b) => canSeeBug(org, b) && (!projectId || b.projectId === projectId))
      .map((b) => withCommentCount(org, b))
      .sort((a, b) => b.number - a.number)
  },

  async getBug(id) {
    await delay()
    const org = currentOrg(loadDb())
    const bug = findVisibleBug(org, id)
    const comments = orgBugs(org)
      .comments.filter((c) => c.bugId === id)
      .map(({ bugId: _bugId, ...c }) => c)
    return { ...withCommentCount(org, bug), comments }
  },

  async createBug(input) {
    await delay()
    requirePermission('bugs.report')
    if (input.assigneeId && !sessionCan('bugs.manage')) throw new ApiError('Only people who triage bugs can assign them.', 403)
    if (!input.title.trim()) throw new ApiError('Title is required.')
    const db = loadDb()
    const org = currentOrg(db)
    if (!org.projects.some((p) => p.id === input.projectId)) throw new ApiError('Choose a valid project.')
    const { bugs } = orgBugs(org)
    const number = bugs.reduce((max, b) => Math.max(max, b.number), 0) + 1
    const bug: Bug = {
      ...input,
      id: newId(),
      number,
      key: `BUG-${number}`,
      status: 'open',
      resolution: null,
      reporterId: getStoredSession()?.user.id ?? null,
      commentCount: 0,
      resolvedAt: null,
      closedAt: null,
      createdAt: now(),
      updatedAt: now(),
    }
    bugs.push(bug)
    logBugEvent(org, bug.id, 'reported this bug')
    saveDb(db)
    return bug
  },

  async updateBug(id, changes) {
    await delay()
    const db = loadDb()
    const org = currentOrg(db)
    const bug = findVisibleBug(org, id)
    const userId = getStoredSession()?.user.id
    const keys = (Object.keys(changes) as Array<keyof typeof changes>).filter((k) => changes[k] !== undefined && changes[k] !== bug[k])
    if (!sessionCan('bugs.manage')) {
      const statusOnly = keys.every((k) => k === 'status' || k === 'resolution')
      const triage = keys.some((k) => k === 'assigneeId' || k === 'priority')
      if (triage) throw new ApiError('Only people who triage bugs can assign or prioritize them.', 403)
      if (bug.reporterId !== userId && !(statusOnly && bug.assigneeId === userId)) {
        throw new ApiError('Only the reporter, the assignee or someone who triages bugs can change this bug.', 403)
      }
    }
    const before = { ...bug }
    Object.assign(bug, changes)
    const finished = bug.status === 'resolved' || bug.status === 'closed'
    bug.resolution = finished ? (bug.resolution ?? 'fixed') : null
    if (bug.status !== before.status) {
      bug.resolvedAt = bug.status === 'resolved' || bug.status === 'closed' ? (before.resolvedAt ?? now()) : null
      bug.closedAt = bug.status === 'closed' ? now() : null
      const wasFinished = before.status === 'resolved' || before.status === 'closed'
      logBugEvent(
        org,
        id,
        wasFinished && !finished ? 'reopened this bug' : `changed the status from ${BUG_STATUS_LABELS[before.status]} to ${BUG_STATUS_LABELS[bug.status]}`,
      )
    }
    if (bug.assigneeId !== before.assigneeId) {
      const name = db.users.find((u) => u.id === bug.assigneeId)?.fullName
      logBugEvent(org, id, name ? `assigned this bug to ${name}` : 'unassigned this bug')
    }
    bug.updatedAt = now()
    saveDb(db)
    return withCommentCount(org, bug)
  },

  async deleteBug(id) {
    await delay()
    const db = loadDb()
    const org = currentOrg(db)
    const bug = findVisibleBug(org, id)
    const reporterMayDelete = bug.reporterId === getStoredSession()?.user.id && bug.status === 'open'
    if (!sessionCan('bugs.manage') && !reporterMayDelete) throw new ApiError('Only people who triage bugs can delete it.', 403)
    const store = orgBugs(org)
    org.bugs = store.bugs.filter((b) => b.id !== id)
    org.bugComments = store.comments.filter((c) => c.bugId !== id)
    saveDb(db)
  },

  async addBugComment(id, body) {
    await delay()
    if (!body.trim()) throw new ApiError('Comment is required.')
    const db = loadDb()
    const org = currentOrg(db)
    findVisibleBug(org, id)
    const { bugId: _bugId, ...comment } = logBugEvent(org, id, body.trim(), 'comment')
    saveDb(db)
    return comment
  },

  async deleteWorkItem(id) {
    await delay()
    const db = loadDb()
    const org = currentOrg(db)
    const item = org.workItems.find((w) => w.id === id)
    if (!item) throw new ApiError('Item not found.', 404)
    if (!managesAllTasks() && item.createdById !== getStoredSession()?.user.id) {
      throw new ApiError('Only a manager can delete this task. You can change its status instead.', 403)
    }
    org.workItems = org.workItems.filter((w) => w.id !== id)
    saveDb(db)
  },
}
