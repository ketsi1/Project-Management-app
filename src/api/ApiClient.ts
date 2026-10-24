import type {
  CustomField,
  FieldInput,
  InviteInput,
  LoginInput,
  Member,
  Project,
  ProjectInput,
  RegisterInput,
  Session,
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
  register(input: RegisterInput): Promise<Session>
  login(input: LoginInput): Promise<Session>
  logout(): Promise<void>

  getWorkspace(): Promise<Workspace>
  updateOrganization(name: string, terminology: Terminology): Promise<void>

  createStatus(input: StatusInput): Promise<Status>
  updateStatus(id: string, input: StatusInput): Promise<Status>
  deleteStatus(id: string, moveToStatusId: string): Promise<void>

  createField(input: FieldInput): Promise<CustomField>
  deleteField(id: string): Promise<void>

  inviteMember(input: InviteInput): Promise<Member>
  removeMember(id: string): Promise<void>

  listProjects(): Promise<Project[]>
  createProject(input: ProjectInput): Promise<Project>
  updateProject(id: string, input: ProjectInput): Promise<Project>
  deleteProject(id: string): Promise<void>

  listWorkItems(projectId?: string): Promise<WorkItem[]>
  createWorkItem(input: WorkItemInput): Promise<WorkItem>
  updateWorkItem(id: string, changes: Partial<WorkItemInput>): Promise<WorkItem>
  deleteWorkItem(id: string): Promise<void>
}
