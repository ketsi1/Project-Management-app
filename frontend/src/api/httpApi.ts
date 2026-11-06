// ---------------------------------------------------------------------------
// REAL BACKEND CLIENT
// Talks to your Express API over HTTP. It is used automatically when
// VITE_API_URL is set in the .env file. Each method below documents the
// endpoint your Express server must provide.
// ---------------------------------------------------------------------------
import type { ApiClient } from './ApiClient'
import { ApiError } from './ApiError'
import { getStoredSession } from './session'

const BASE_URL = import.meta.env.VITE_API_URL as string | undefined

// Sends one request and returns the parsed JSON (or nothing for 204 responses).
async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const session = getStoredSession()
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (response.status === 204) return undefined as T

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    // The Express API should reply with { "message": "..." } on errors.
    throw new ApiError(data.message ?? 'Request failed.', response.status)
  }
  return data as T
}

export const httpApi: ApiClient = {
  register: (input) => request('POST', '/auth/register', input), // → { pending, message } (no login)
  login: (input) => request('POST', '/auth/login', input), // → Session
  logout: () => request('POST', '/auth/logout'), // → 204
  me: () => request('GET', '/auth/me'), // → SessionInfo
  acceptInvite: (token, password) => request('POST', '/auth/accept-invite', { token, password }), // → Session
  demoAccounts: () => request('GET', '/auth/demo-accounts'), // → DemoAccount[]

  getWorkspace: () => request('GET', '/workspace'), // → Workspace
  updateOrganization: (name, terminology) =>
    request('PUT', '/organization', { name, terminology }), // → 204

  createStatus: (input) => request('POST', '/statuses', input), // → Status
  updateStatus: (id, input) => request('PUT', `/statuses/${id}`, input), // → Status
  deleteStatus: (id, moveToStatusId) =>
    request('DELETE', `/statuses/${id}?moveTo=${moveToStatusId}`), // → 204

  createField: (input) => request('POST', '/fields', input), // → CustomField
  deleteField: (id) => request('DELETE', `/fields/${id}`), // → 204

  inviteMember: (input) => request('POST', '/members', input), // → InviteResult
  approveMember: (id) => request('POST', `/members/${id}/approve`), // → 204
  updateMemberRole: (id, roleId) => request('PUT', `/members/${id}/role`, { roleId }), // → { role }
  removeMember: (id) => request('DELETE', `/members/${id}`), // → 204 (also rejects a pending sign-up)

  listPermissions: () => request('GET', '/permissions'), // → PermissionInfo[]
  listRoles: () => request('GET', '/roles'), // → RoleDetail[]
  createRole: (input) => request('POST', '/roles', input), // → RoleDetail
  updateRole: (id, input) => request('PUT', `/roles/${id}`, input), // → RoleDetail
  deleteRole: (id) => request('DELETE', `/roles/${id}`), // → 204

  listProjects: () => request('GET', '/projects'), // → Project[]
  createProject: (input) => request('POST', '/projects', input), // → Project
  updateProject: (id, input) => request('PUT', `/projects/${id}`, input), // → Project
  deleteProject: (id) => request('DELETE', `/projects/${id}`), // → 204

  listWorkItems: (projectId) =>
    request('GET', projectId ? `/work-items?projectId=${projectId}` : '/work-items'), // → WorkItem[]
  createWorkItem: (input) => request('POST', '/work-items', input), // → WorkItem
  updateWorkItem: (id, changes) => request('PATCH', `/work-items/${id}`, changes), // → WorkItem
  deleteWorkItem: (id) => request('DELETE', `/work-items/${id}`), // → 204

  listBugs: (projectId) => request('GET', projectId ? `/bugs?projectId=${projectId}` : '/bugs'), // → Bug[]
  getBug: (id) => request('GET', `/bugs/${id}`), // → BugDetail
  createBug: (input) => request('POST', '/bugs', input), // → Bug
  updateBug: (id, changes) => request('PATCH', `/bugs/${id}`, changes), // → Bug
  deleteBug: (id) => request('DELETE', `/bugs/${id}`), // → 204
  addBugComment: (id, body) => request('POST', `/bugs/${id}/comments`, { body }), // → BugComment
}
