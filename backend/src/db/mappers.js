// Turn Prisma records into the JSON shapes in frontend/src/types.ts.
import { toDateOnly, toIso } from '../utils/time.js'

const asObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {})
const asArray = (value) => (Array.isArray(value) ? value : [])

export const toOrganization = (org) => ({ id: org.id, name: org.name })

export const toTerminology = (org) => ({
  project: org.termProject,
  projects: org.termProjects,
  task: org.termTask,
  tasks: org.termTasks,
})

export const toStatus = (s) => ({ id: s.id, name: s.name, category: s.category, color: s.color, position: s.position })

export const toField = (f) => ({ id: f.id, label: f.label, type: f.type, options: asArray(f.options) })

// A membership loaded with `include: memberInclude`.
export const memberInclude = {
  user: { select: { id: true, fullName: true, email: true, passwordHash: true } },
  role: { select: { id: true, slug: true, name: true } },
}

export const toMember = (m) => ({
  id: m.user.id,
  fullName: m.user.fullName,
  email: m.user.email,
  role: m.role.slug,
  roleId: m.role.id,
  roleName: m.role.name,
  // false while an invited person has not chosen a password yet
  activated: m.user.passwordHash !== null,
})

export const toProject = (p) => ({
  id: p.id,
  name: p.name,
  description: p.description ?? '',
  createdAt: toIso(p.createdAt),
})

export const toWorkItem = (w) => ({
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
}

export const toBug = (b) => ({
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
export const toBugComment = (c) => ({
  id: c.id,
  kind: c.kind,
  authorId: c.authorId ?? null,
  authorName: c.author?.fullName ?? null,
  body: c.body,
  createdAt: toIso(c.createdAt),
})
