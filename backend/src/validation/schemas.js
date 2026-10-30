// Request shapes, matching pm-frontend/src/types.ts. Messages are shown to the user as-is.
import { z } from 'zod'

const text = (label, max) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be at most ${max} characters.`)

const optionalText = (label, max) =>
  z
    .string({ error: `${label} must be text.` })
    .trim()
    .max(max, `${label} must be at most ${max} characters.`)

const id = (label) => z.string({ error: `${label} is required.` }).trim().min(1, `${label} is required.`).max(64)

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

export const roles = ['owner', 'admin', 'member']
export const statusCategories = ['not_started', 'active', 'done', 'cancelled']
export const priorities = ['low', 'medium', 'high', 'urgent']
export const fieldTypes = ['text', 'number', 'date', 'select']

// --- Auth -------------------------------------------------------------------

export const registerSchema = z.object({
  fullName: text('Full name', 150),
  organizationName: text('Organization name', 255),
  email,
  password: newPassword,
})

export const loginSchema = z.object({
  email,
  password: z.string({ error: 'Please enter your email and password.' }).min(1, 'Please enter your email and password.'),
})

export const acceptInviteSchema = z.object({
  token: z.string({ error: 'Invitation token is required.' }).min(10, 'Invitation token is invalid.').max(200),
  password: newPassword,
})

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

// --- Members ------------------------------------------------------------------

export const inviteSchema = z.object({
  fullName: text('Full name', 150),
  email,
  role: z.enum(roles, { error: 'Choose a valid role.' }),
})

// --- Projects -----------------------------------------------------------------

export const projectSchema = z.object({
  name: text('Project name', 255),
  description: optionalText('Description', 10_000).default(''),
})

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

// PATCH: every field optional, but at least one must be sent.
export const updateWorkItemSchema = z
  .object(workItemFields)
  .partial()
  .refine((changes) => Object.keys(changes).length > 0, 'Nothing to update.')

export const listWorkItemsQuery = z.object({
  projectId: id('Project').optional(),
})
