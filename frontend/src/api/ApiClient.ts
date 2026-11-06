import type {
  Bug,
  BugChanges,
  BugComment,
  BugDetail,
  BugInput,
  CustomField,
  FieldInput,
  DemoAccount,
  InviteInput,
  InviteResult,
  LoginInput,
  Project,
  ProjectInput,
  RegisterInput,
  RegisterResult,
  PermissionInfo,
  RoleDetail,
  RoleInput,
  Session,
  SessionInfo,
  Status,
  StatusInput,
  Terminology,
  WorkItem,
  WorkItemInput,
  Workspace,
} from '../types'

// Every operation the frontend needs from a backend.
// Both the mock backend and the real HTTP client follow this contract,
// so the rest of the app never needs to know which one it is using.
export interface ApiClient {
  register(input: RegisterInput): Promise<RegisterResult>
  login(input: LoginInput): Promise<Session>
  logout(): Promise<void>
  // The current role and permissions (they can change while logged in).
  me(): Promise<SessionInfo>
  // Sets the first password from an invitation link and logs in.
  acceptInvite(token: string, password: string): Promise<Session>
  // One-click logins for the login page (empty in production).
  demoAccounts(): Promise<DemoAccount[]>

  getWorkspace(): Promise<Workspace>
  updateOrganization(name: string, terminology: Terminology): Promise<void>

  createStatus(input: StatusInput): Promise<Status>
  updateStatus(id: string, input: StatusInput): Promise<Status>
  deleteStatus(id: string, moveToStatusId: string): Promise<void>

  createField(input: FieldInput): Promise<CustomField>
  deleteField(id: string): Promise<void>

  inviteMember(input: InviteInput): Promise<InviteResult>
  approveMember(id: string): Promise<void>
  updateMemberRole(id: string, roleId: string): Promise<void>
  removeMember(id: string): Promise<void>

  listPermissions(): Promise<PermissionInfo[]>
  listRoles(): Promise<RoleDetail[]>
  createRole(input: RoleInput): Promise<RoleDetail>
  updateRole(id: string, input: RoleInput): Promise<RoleDetail>
  deleteRole(id: string): Promise<void>

  listProjects(): Promise<Project[]>
  createProject(input: ProjectInput): Promise<Project>
  updateProject(id: string, input: ProjectInput): Promise<Project>
  deleteProject(id: string): Promise<void>

  listWorkItems(projectId?: string): Promise<WorkItem[]>
  createWorkItem(input: WorkItemInput): Promise<WorkItem>
  updateWorkItem(id: string, changes: Partial<WorkItemInput>): Promise<WorkItem>
  deleteWorkItem(id: string): Promise<void>

  listBugs(projectId?: string): Promise<Bug[]>
  getBug(id: string): Promise<BugDetail>
  createBug(input: BugInput): Promise<Bug>
  updateBug(id: string, changes: BugChanges): Promise<Bug>
  deleteBug(id: string): Promise<void>
  addBugComment(id: string, body: string): Promise<BugComment>
}
