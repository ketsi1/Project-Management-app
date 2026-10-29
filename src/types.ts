// ---------------------------------------------------------------------------
// Shared data types. These describe the data the frontend works with and
// match the JSON your Express API should send and receive.
// ---------------------------------------------------------------------------

// The four fixed categories every organization's statuses map to.
export type StatusCategory = 'not_started' | 'active' | 'done' | 'cancelled'

export type Priority = 'low' | 'medium' | 'high' | 'urgent'

export type Role = 'owner' | 'admin' | 'member'

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
}

// What the frontend keeps after a successful login or registration.
export interface Session {
  token: string
  user: User
  organization: Organization
  role: Role
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
}

// Input shapes for create and update requests.
export type WorkItemInput = Omit<WorkItem, 'id' | 'createdAt' | 'updatedAt'>
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

export interface InviteInput {
  fullName: string
  email: string
  role: Role
}
