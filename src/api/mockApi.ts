// ---------------------------------------------------------------------------
// MOCK BACKEND
// A pretend server that keeps all data in the browser's localStorage.
// It lets you use the whole app before the Express + MySQL backend exists.
// Delete nothing here when the real backend is ready: just set VITE_API_URL
// in the .env file and the app switches to httpApi automatically.
// ---------------------------------------------------------------------------
import type {
  CustomField,
  Member,
  Organization,
  Project,
  Role,
  Session,
  Status,
  Terminology,
  WorkItem,
} from '../types'
import type { ApiClient } from './ApiClient'
import { ApiError } from './ApiError'
import { getStoredSession } from './session'

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
}

interface Database {
  users: StoredUser[]
  organizations: StoredOrganization[]
}

// v3: one manager + two developers with their own passwords, and sign-ups that wait for approval.
// The new key makes browsers that saved the old demo data load the new users.
const DB_KEY = 'pm-mock-db-v3'

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

function requireAdmin(): void {
  const session = getStoredSession()
  if (!session || session.role === 'member') {
    throw new ApiError('Only owners and admins can change settings.', 403)
  }
}

function toSession(user: StoredUser, organization: Organization): Session {
  return {
    token: `mock-${user.id}`,
    user: { id: user.id, fullName: user.fullName, email: user.email },
    organization,
    role: user.role,
  }
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

  async getWorkspace() {
    await delay()
    const db = loadDb()
    const org = currentOrg(db)
    const inOrg = db.users.filter((u) => u.organizationId === org.organization.id)
    const toMember = (u: StoredUser): Member => ({ id: u.id, fullName: u.fullName, email: u.email, role: u.role })
    const session = getStoredSession()
    const isManager = session?.role === 'owner' || session?.role === 'admin'
    return {
      organization: org.organization,
      terminology: org.terminology,
      statuses: [...org.statuses].sort((a, b) => a.position - b.position),
      fields: org.fields,
      members: inOrg.filter((u) => u.status !== 'pending').map(toMember),
      pendingMembers: isManager ? inOrg.filter((u) => u.status === 'pending').map(toMember) : [],
    }
  },

  async updateOrganization(name, terminology) {
    await delay()
    requireAdmin()
    const db = loadDb()
    const org = currentOrg(db)
    org.organization.name = name
    org.terminology = terminology
    saveDb(db)
  },

  async createStatus(input) {
    await delay()
    requireAdmin()
    const db = loadDb()
    const org = currentOrg(db)
    const status: Status = { ...input, id: newId() }
    org.statuses.push(status)
    saveDb(db)
    return status
  },

  async updateStatus(id, input) {
    await delay()
    requireAdmin()
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
    requireAdmin()
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
    requireAdmin()
    const db = loadDb()
    const org = currentOrg(db)
    const field: CustomField = { ...input, id: newId() }
    org.fields.push(field)
    saveDb(db)
    return field
  },

  async deleteField(id) {
    await delay()
    requireAdmin()
    const db = loadDb()
    const org = currentOrg(db)
    org.fields = org.fields.filter((f) => f.id !== id)
    saveDb(db)
  },

  async inviteMember(input) {
    await delay()
    requireAdmin()
    const db = loadDb()
    const org = currentOrg(db)
    const email = input.email.trim().toLowerCase()
    if (db.users.some((u) => u.email === email)) {
      throw new ApiError('This email already has an account.', 409)
    }
    // In the mock, invited members can log in with password123.
    // The real backend will email them a link to set their password.
    const user: StoredUser = {
      id: newId(),
      fullName: input.fullName.trim(),
      email,
      passwordHash: DEFAULT_PASSWORD_HASH,
      organizationId: org.organization.id,
      role: input.role,
    }
    db.users.push(user)
    saveDb(db)
    return { id: user.id, fullName: user.fullName, email: user.email, role: user.role }
  },

  async approveMember(id) {
    await delay()
    requireAdmin()
    const db = loadDb()
    const org = currentOrg(db)
    const user = db.users.find((u) => u.id === id && u.organizationId === org.organization.id && u.status === 'pending')
    if (!user) throw new ApiError('No pending sign-up found for this person.', 404)
    user.status = 'active'
    saveDb(db)
  },

  async removeMember(id) {
    await delay()
    requireAdmin()
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
    return org.projects
  },

  async createProject(input) {
    await delay()
    const db = loadDb()
    const org = currentOrg(db)
    const project: Project = { ...input, id: newId(), createdAt: now() }
    org.projects.push(project)
    saveDb(db)
    return project
  },

  async updateProject(id, input) {
    await delay()
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
    const db = loadDb()
    const org = currentOrg(db)
    org.projects = org.projects.filter((p) => p.id !== id)
    org.workItems = org.workItems.filter((w) => w.projectId !== id)
    saveDb(db)
  },

  async listWorkItems(projectId) {
    await delay()
    const org = currentOrg(loadDb())
    return projectId ? org.workItems.filter((w) => w.projectId === projectId) : org.workItems
  },

  async createWorkItem(input) {
    await delay()
    const db = loadDb()
    const org = currentOrg(db)
    if (!input.title.trim()) throw new ApiError('Title is required.')
    const item: WorkItem = { ...input, id: newId(), createdAt: now(), updatedAt: now() }
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
    org.workItems[index] = { ...org.workItems[index], ...changes, updatedAt: now() }
    saveDb(db)
    return org.workItems[index]
  },

  async deleteWorkItem(id) {
    await delay()
    const db = loadDb()
    const org = currentOrg(db)
    org.workItems = org.workItems.filter((w) => w.id !== id)
    saveDb(db)
  },
}
