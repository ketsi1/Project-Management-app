// Turn Prisma records into the JSON shapes in frontend/src/types.ts.
import type { BugComment, CustomField, Organization, Prisma, Project, Status, WorkItem } from '../generated/prisma/client.ts'
import { toDateOnly, toIso } from '../utils/time.ts'

// JSON columns come back as Prisma.JsonValue; the app only ever stores these shapes in them.
const asObject = (value: Prisma.JsonValue | null): Record<string, string> =>
  (value && typeof value === 'object' && !Array.isArray(value) ? value : {}) as Record<string, string>
const asArray = (value: Prisma.JsonValue | null): string[] => (Array.isArray(value) ? value : []) as string[]

export const toOrganization = (org: Organization) => ({ id: org.id, name: org.name })

export const toTerminology = (org: Organization) => ({
  project: org.termProject,
  projects: org.termProjects,
  task: org.termTask,
  tasks: org.termTasks,
})

export const toStatus = (s: Status) => ({ id: s.id, name: s.name, category: s.category, color: s.color, position: s.position })

export const toField = (f: CustomField) => ({ id: f.id, label: f.label, type: f.type, options: asArray(f.options) })

// A membership loaded with `include: memberInclude`.
export const memberInclude = {
  user: { select: { id: true, fullName: true, email: true, passwordHash: true } },
  role: { select: { id: true, slug: true, name: true } },
} as const satisfies Prisma.OrganizationMemberInclude

type MemberRecord = Prisma.OrganizationMemberGetPayload<{ include: typeof memberInclude }>

export const toMember = (m: MemberRecord) => ({
  id: m.user.id,
  fullName: m.user.fullName,
  email: m.user.email,
  role: m.role.slug,
  roleId: m.role.id,
  roleName: m.role.name,
  // false while an invited person has not chosen a password yet
  activated: m.user.passwordHash !== null,
})

export const toProject = (p: Project) => ({
  id: p.id,
  name: p.name,
  description: p.description ?? '',
  createdAt: toIso(p.createdAt),
})

export const toWorkItem = (w: WorkItem) => ({
  id: w.id,
  projectId: w.projectId,
  title: w.title,
  description: w.description ?? '',
  statusId: w.statusId,
  priority: w.priority,
  assigneeId: w.assigneeId,
  dueDate: toDateOnly(w.dueDate),
  customValues: asObject(w.customValues),
  createdById: w.createdById ?? null,
  createdAt: toIso(w.createdAt),
  updatedAt: toIso(w.updatedAt),
})

// Bugs are loaded with `include: bugInclude` so the list can show how many comments each has
// (activity entries are not counted).
export const bugInclude = {
  _count: { select: { comments: { where: { kind: 'comment' } } } },
} as const satisfies Prisma.BugInclude

type BugRecord = Prisma.BugGetPayload<{ include: typeof bugInclude }>

export const toBug = (b: BugRecord) => ({
  id: b.id,
  number: b.number,
  key: `BUG-${b.number}`,
  projectId: b.projectId,
  workItemId: b.workItemId ?? null,
  title: b.title,
  description: b.description ?? '',
  stepsToReproduce: b.stepsToReproduce ?? '',
  expectedResult: b.expectedResult ?? '',
  actualResult: b.actualResult ?? '',
  environment: b.environment ?? '',
  severity: b.severity,
  priority: b.priority,
  status: b.status,
  resolution: b.resolution ?? null,
  reporterId: b.reporterId ?? null,
  assigneeId: b.assigneeId ?? null,
  commentCount: b._count?.comments ?? 0,
  resolvedAt: toIso(b.resolvedAt),
  closedAt: toIso(b.closedAt),
  createdAt: toIso(b.createdAt),
  updatedAt: toIso(b.updatedAt),
})

// Comments are loaded with `include: { author: { select: { fullName: true } } }`.
export const toBugComment = (c: BugComment & { author: { fullName: string } | null }) => ({
  id: c.id,
  kind: c.kind,
  authorId: c.authorId ?? null,
  authorName: c.author?.fullName ?? null,
  body: c.body,
  createdAt: toIso(c.createdAt),
})

// The JSON shapes the API returns (frontend/src/types.ts has the same shapes).
export type ProjectDto = ReturnType<typeof toProject>
export type WorkItemDto = ReturnType<typeof toWorkItem>
export type BugDto = ReturnType<typeof toBug>
export type BugCommentDto = ReturnType<typeof toBugComment>
export type MemberDto = ReturnType<typeof toMember>
export type StatusDto = ReturnType<typeof toStatus>
export type FieldDto = ReturnType<typeof toField>
