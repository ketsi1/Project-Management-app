// Request shapes, matching frontend/src/types.ts. Messages are shown to the user as-is.
// Each schema also gives a TypeScript type (z.infer) that the services take as input.
import { z } from 'zod'

const text = (label: string, max: number) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be at most ${max} characters.`)

const optionalText = (label: string, max: number) =>
  z
    .string({ error: `${label} must be text.` })
    .trim()
    .max(max, `${label} must be at most ${max} characters.`)

const id = (label: string) => z.string({ error: `${label} is required.` }).trim().min(1, `${label} is required.`).max(64)

const email = z
  .string({ error: 'Email is required.' })
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address.').max(255, 'Email is too long.'))

// bcrypt only uses the first 72 bytes, so longer passwords are rejected rather than silently cut.
const newPassword = z
  .string({ error: 'Password is required.' })
  .min(8, 'Password must be at least 8 characters.')
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 bytes.')

export const statusCategories = ['not_started', 'active', 'done', 'cancelled'] as const
export const priorities = ['low', 'medium', 'high', 'urgent'] as const
export const fieldTypes = ['text', 'number', 'date', 'select'] as const

// --- Auth -------------------------------------------------------------------

export const registerSchema = z.object({
  fullName: text('Full name', 150),
  organizationName: text('Organization name', 255),
  email,
  password: newPassword,
})
export type RegisterInput = z.infer<typeof registerSchema>

export const loginSchema = z.object({
  email,
  password: z.string({ error: 'Please enter your email and password.' }).min(1, 'Please enter your email and password.'),
})
export type LoginInput = z.infer<typeof loginSchema>

export const acceptInviteSchema = z.object({
  token: z.string({ error: 'Invitation token is required.' }).min(10, 'Invitation token is invalid.').max(200),
  password: newPassword,
})
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>

// --- Organization -------------------------------------------------------------

export const updateOrganizationSchema = z.object({
  name: text('Organization name', 255),
  terminology: z.object(
    {
      project: text('The word for "project"', 50),
      projects: text('The word for "projects"', 50),
      task: text('The word for "task"', 50),
      tasks: text('The word for "tasks"', 50),
    },
    { error: 'Terminology is required.' },
  ),
})
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>

// --- Statuses -----------------------------------------------------------------

export const statusSchema = z.object({
  name: text('Status name', 100),
  category: z.enum(statusCategories, { error: 'Choose a valid status category.' }),
  color: z
    .string({ error: 'Color is required.' })
    .trim()
    .regex(/^#[0-9a-fA-F]{3,8}$/, 'Color must be a hex value like #3b82f6.'),
  position: z.coerce.number({ error: 'Position must be a number.' }).int().min(0).max(10_000),
})
export type StatusInput = z.infer<typeof statusSchema>

export const deleteStatusQuery = z.object({
  moveTo: id('Choose another status to move the items to.'),
})

// --- Custom fields ------------------------------------------------------------

export const fieldSchema = z
  .object({
    label: text('Field label', 100),
    type: z.enum(fieldTypes, { error: 'Choose a valid field type.' }),
    options: z.array(text('Option', 100)).max(100, 'A field can have at most 100 options.').default([]),
  })
  .refine((field) => field.type !== 'select' || field.options.length > 0, {
    message: 'A dropdown field needs at least one option.',
  })
  .transform((field) => ({ ...field, options: field.type === 'select' ? [...new Set(field.options)] : [] }))
export type FieldInput = z.infer<typeof fieldSchema>

// --- Members ------------------------------------------------------------------

// Without a password the person gets an invitation link to choose one themselves.
export const inviteSchema = z.object({
  fullName: text('Full name', 150),
  email,
  roleId: id('Role'),
  password: newPassword.optional().or(z.literal('').transform(() => undefined)),
})
export type InviteInput = z.infer<typeof inviteSchema>

export const memberRoleSchema = z.object({
  roleId: id('Role'),
})

// --- Roles --------------------------------------------------------------------

export const roleSchema = z.object({
  name: text('Role name', 100),
  description: optionalText('Description', 500).default(''),
  permissions: z
    .array(z.string().max(100), { error: 'Permissions must be a list.' })
    .max(200)
    .transform((keys) => [...new Set(keys)]),
})
export type RoleInput = z.infer<typeof roleSchema>

// --- Projects -----------------------------------------------------------------

export const projectSchema = z.object({
  name: text('Project name', 255),
  description: optionalText('Description', 10_000).default(''),
})
export type ProjectInput = z.infer<typeof projectSchema>

// --- Work items ---------------------------------------------------------------

const dueDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must look like 2025-01-31.')
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'Due date is not a real date.')
  .nullable()
  .or(z.literal('').transform(() => null))

const workItemFields = {
  projectId: id('Project'),
  title: text('Title', 255),
  description: optionalText('Description', 20_000),
  statusId: id('Status'),
  priority: z.enum(priorities, { error: 'Choose a valid priority.' }),
  assigneeId: z.string().trim().max(64).nullable().or(z.literal('').transform(() => null)),
  dueDate,
  customValues: z
    .record(z.string().max(64), z.string().max(2000, 'A custom value is too long.'))
    .refine((values) => Object.keys(values).length <= 100, 'Too many custom values.'),
}

export const createWorkItemSchema = z.object({
  ...workItemFields,
  description: workItemFields.description.default(''),
  assigneeId: workItemFields.assigneeId.default(null),
  dueDate: workItemFields.dueDate.default(null),
  customValues: workItemFields.customValues.default({}),
  priority: workItemFields.priority.default('medium'),
})
export type CreateWorkItemInput = z.infer<typeof createWorkItemSchema>

// PATCH: every field optional, but at least one must be sent.
export const updateWorkItemSchema = z
  .object(workItemFields)
  .partial()
  .refine((changes) => Object.keys(changes).length > 0, 'Nothing to update.')
export type UpdateWorkItemInput = z.infer<typeof updateWorkItemSchema>

export const listWorkItemsQuery = z.object({
  projectId: id('Project').optional(),
})

// --- Bugs ---------------------------------------------------------------------

export const bugSeverities = ['critical', 'major', 'minor', 'trivial'] as const
export const bugStatuses = ['open', 'in_progress', 'resolved', 'closed'] as const
export const bugResolutions = ['fixed', 'wont_fix', 'duplicate', 'cannot_reproduce', 'by_design'] as const

const optionalId = z.string().trim().max(64).nullable().or(z.literal('').transform(() => null))

const bugFields = {
  projectId: id('Project'),
  workItemId: optionalId,
  title: text('Title', 255),
  description: optionalText('Description', 20_000),
  stepsToReproduce: optionalText('Steps to reproduce', 20_000),
  expectedResult: optionalText('Expected result', 5_000),
  actualResult: optionalText('Actual result', 5_000),
  environment: optionalText('Environment', 255),
  severity: z.enum(bugSeverities, { error: 'Choose a valid severity.' }),
  priority: z.enum(priorities, { error: 'Choose a valid priority.' }),
  status: z.enum(bugStatuses, { error: 'Choose a valid status.' }),
  resolution: z.enum(bugResolutions, { error: 'Choose a valid resolution.' }).nullable(),
  assigneeId: optionalId,
}

export const createBugSchema = z.object({
  projectId: bugFields.projectId,
  workItemId: bugFields.workItemId.default(null),
  title: bugFields.title,
  description: bugFields.description.default(''),
  stepsToReproduce: bugFields.stepsToReproduce.default(''),
  expectedResult: bugFields.expectedResult.default(''),
  actualResult: bugFields.actualResult.default(''),
  environment: bugFields.environment.default(''),
  severity: bugFields.severity.default('major'),
  priority: bugFields.priority.default('medium'),
  assigneeId: bugFields.assigneeId.default(null),
})
export type CreateBugInput = z.infer<typeof createBugSchema>

export const updateBugSchema = z
  .object(bugFields)
  .partial()
  .refine((changes) => Object.keys(changes).length > 0, 'Nothing to update.')
export type UpdateBugInput = z.infer<typeof updateBugSchema>

export const listBugsQuery = z.object({
  projectId: id('Project').optional(),
})

export const bugCommentSchema = z.object({
  body: text('Comment', 10_000),
})
export type BugCommentInput = z.infer<typeof bugCommentSchema>
