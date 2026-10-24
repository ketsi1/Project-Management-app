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
}

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

const DB_KEY = 'pm-mock-db'

// --- Small helpers ---------------------------------------------------------

function loadDb(): Database {
  const raw = localStorage.getItem(DB_KEY)
  if (!raw) return { users: [], organizations: [] }
  return JSON.parse(raw) as Database
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
// (The real backend must use bcrypt or argon2 instead: they are slower on purpose.)
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

// --- The starting setup every new organization receives -------------------

function seedOrganization(name: string, ownerId: string): StoredOrganization {
  const statuses: Status[] = [
    { id: newId(), name: 'To do', category: 'not_started', color: '#94a3b8', position: 0 },
    { id: newId(), name: 'In progress', category: 'active', color: '#3b82f6', position: 1 },
    { id: newId(), name: 'In review', category: 'active', color: '#f59e0b', position: 2 },
    { id: newId(), name: 'Done', category: 'done', color: '#22c55e', position: 3 },
  ]
  const project: Project = {
    id: newId(),
    name: 'Getting started',
    description: 'A sample project to explore the board.',
    createdAt: now(),
  }
  const sample = (title: string, statusIndex: number, priority: WorkItem['priority'], days: number): WorkItem => ({
    id: newId(),
    projectId: project.id,
    title,
    description: '',
    statusId: statuses[statusIndex].id,
    priority,
    assigneeId: ownerId,
    dueDate: new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10),
    customValues: {},
    createdAt: now(),
    updatedAt: now(),
  })
  return {
    organization: { id: newId(), name },
    terminology: { project: 'Project', projects: 'Projects', task: 'Task', tasks: 'Tasks' },
    statuses,
    fields: [],
    projects: [project],
    workItems: [
      sample('Invite your team members', 0, 'high', 2),
      sample('Rename statuses to match your process', 1, 'medium', 4),
      sample('Add a custom field in Settings', 2, 'low', 7),
      sample('Create your account', 3, 'low', -1),
    ],
  }
}

// --- The mock API itself ---------------------------------------------------

export const mockApi: ApiClient = {
  async register(input) {
    await delay()
    const db = loadDb()
    const email = input.email.trim().toLowerCase()
    if (db.users.some((u) => u.email === email)) {
      throw new ApiError('An account with this email already exists.', 409)
    }
    const userId = newId()
    const org = seedOrganization(input.organizationName.trim(), userId)
    const user: StoredUser = {
      id: userId,
      fullName: input.fullName.trim(),
      email,
      passwordHash: await hashPassword(input.password),
      organizationId: org.organization.id,
      role: 'owner',
    }
    db.users.push(user)
    db.organizations.push(org)
    saveDb(db)
    return toSession(user, org.organization)
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
    const members: Member[] = db.users
      .filter((u) => u.organizationId === org.organization.id)
      .map((u) => ({ id: u.id, fullName: u.fullName, email: u.email, role: u.role }))
    return {
      organization: org.organization,
      terminology: org.terminology,
      statuses: [...org.statuses].sort((a, b) => a.position - b.position),
      fields: org.fields,
      members,
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
    // In the mock, invited members have no password and cannot log in.
    // The real backend will email them a link to set their password.
    const user: StoredUser = {
      id: newId(),
      fullName: input.fullName.trim(),
      email,
      passwordHash: '',
      organizationId: org.organization.id,
      role: input.role,
    }
    db.users.push(user)
    saveDb(db)
    return { id: user.id, fullName: user.fullName, email: user.email, role: user.role }
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
