// ---------------------------------------------------------------------------
// Shared data types. These describe the data the frontend works with and
// match the JSON your Express API should send and receive.
// ---------------------------------------------------------------------------

// The four fixed categories every organization's statuses map to.
export type StatusCategory = 'not_started' | 'active' | 'done' | 'cancelled'

export type Priority = 'low' | 'medium' | 'high' | 'urgent'

// A role's short name ('owner', 'admin', 'manager', 'member' or one an admin created).
export type Role = string

// What a role can be allowed to do. Matches backend/src/auth/permissions.js.
export type Permission =
  | 'organization.update'
  | 'statuses.manage'
  | 'fields.manage'
  | 'members.view'
  | 'members.create'
  | 'members.approve'
  | 'members.update_role'
  | 'members.remove'
  | 'roles.manage'
  | 'projects.view_all'
  | 'projects.create'
  | 'projects.update'
  | 'projects.delete'
  | 'tasks.view_all'
  | 'tasks.create'
  | 'tasks.manage_all'
  | 'bugs.report'
  | 'bugs.view_all'
  | 'bugs.manage'

export interface PermissionInfo {
  key: Permission
  name: string
  description: string
  group: string
}

export interface RoleSummary {
  id: string
  slug: Role
  name: string
}

// A role with its permissions, as shown in Settings → Roles.
export interface RoleDetail extends RoleSummary {
  description: string
  isSystem: boolean
  // The owner role: always every permission, cannot be edited.
  locked: boolean
  permissions: Permission[]
  memberCount: number
}

export interface RoleInput {
  name: string
  description: string
  permissions: Permission[]
}

export type ViewMode = 'manager' | 'employee'

export type FieldType = 'text' | 'number' | 'date' | 'select'

export interface User {
  id: string
  fullName: string
  email: string
}

export interface Organization {
  id: string
  name: string
}

export interface Member extends User {
  role: Role
  roleId: string
  roleName: string
  // false while an invited person has not chosen a password yet
  activated: boolean
}

// What the frontend keeps after a successful login or registration.
export interface Session {
  token: string
  user: User
  organization: Organization
  role: Role
  roleName: string
  permissions: Permission[]
}

// The current role and permissions, refreshed from the server (they can change after login).
export interface SessionInfo {
  user: User
  role: Role
  roleName: string
  permissions: Permission[]
}

// A one-click login shown on the login page in development.
export interface DemoAccount {
  fullName: string
  email: string
  password: string
  role: Role
  roleName: string
}

// A status defined by the organization, e.g. "In review" in category "active".
export interface Status {
  id: string
  name: string
  category: StatusCategory
  color: string
  position: number
}

// A custom field defined by the organization, e.g. "Budget" of type number.
export interface CustomField {
  id: string
  label: string
  type: FieldType
  options: string[]
}

// The organization's own words for "project" and "task".
export interface Terminology {
  project: string
  projects: string
  task: string
  tasks: string
}

export interface Project {
  id: string
  name: string
  description: string
  createdAt: string
}

// The universal unit of work. Its status, fields and wording are configurable.
export interface WorkItem {
  id: string
  projectId: string
  title: string
  description: string
  statusId: string
  priority: Priority
  assigneeId: string | null
  dueDate: string | null
  customValues: Record<string, string>
  // Who created the item. Employees may only edit or delete items they created.
  createdById: string | null
  createdAt: string
  updatedAt: string
}

// Everything about the organization's configuration, loaded once after login.
export interface Workspace {
  organization: Organization
  terminology: Terminology
  statuses: Status[]
  fields: CustomField[]
  members: Member[]
  // Sign-ups waiting for a manager to approve them. Always empty for employees.
  pendingMembers: Member[]
  roles: RoleSummary[]
}

// Input shapes for create and update requests.
export type WorkItemInput = Omit<WorkItem, 'id' | 'createdById' | 'createdAt' | 'updatedAt'>
export type ProjectInput = Pick<Project, 'name' | 'description'>
export type StatusInput = Omit<Status, 'id'>
export type FieldInput = Omit<CustomField, 'id'>

// What sign-up returns: the account exists but cannot log in until a manager approves it.
export interface RegisterResult {
  pending: true
  message: string
}

export interface RegisterInput {
  fullName: string
  organizationName: string
  email: string
  password: string
}

export interface LoginInput {
  email: string
  password: string
}

// Without a password the person gets an invitation link to choose one.
export interface InviteInput {
  fullName: string
  email: string
  roleId: string
  password?: string
}

export interface InviteResult extends Member {
  // Outside production the backend returns the activation link so an admin can pass it on.
  inviteLink?: string
}

// --- Bug tracking ------------------------------------------------------------

export type BugSeverity = 'critical' | 'major' | 'minor' | 'trivial'
// open → in_progress → resolved → closed. Reopening moves it back to open.
export type BugStatus = 'open' | 'in_progress' | 'resolved' | 'closed'
export type BugResolution = 'fixed' | 'wont_fix' | 'duplicate' | 'cannot_reproduce' | 'by_design'

export interface Bug {
  id: string
  number: number
  // 'BUG-12'
  key: string
  projectId: string
  // An optional task this bug belongs to (same project).
  workItemId: string | null
  title: string
  description: string
  stepsToReproduce: string
  expectedResult: string
  actualResult: string
  environment: string
  severity: BugSeverity
  priority: Priority
  status: BugStatus
  // Set once the bug is resolved or closed.
  resolution: BugResolution | null
  reporterId: string | null
  assigneeId: string | null
  commentCount: number
  resolvedAt: string | null
  closedAt: string | null
  createdAt: string
  updatedAt: string
}

// A comment, or an automatic activity entry ('event', e.g. "changed the status…").
export interface BugComment {
  id: string
  kind: 'comment' | 'event'
  authorId: string | null
  authorName: string | null
  body: string
  createdAt: string
}

export interface BugDetail extends Bug {
  comments: BugComment[]
}

export type BugInput = Pick<
  Bug,
  'projectId' | 'workItemId' | 'title' | 'description' | 'stepsToReproduce' | 'expectedResult' | 'actualResult' | 'environment' | 'severity' | 'priority' | 'assigneeId'
>
export type BugChanges = Partial<BugInput & Pick<Bug, 'status' | 'resolution'>>
