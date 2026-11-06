// Every endpoint pm-frontend/src/api/httpApi.ts calls, mounted under /api.
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import * as auth from '../controllers/authController.js'
import * as bugs from '../controllers/bugController.js'
import * as projects from '../controllers/projectController.js'
import * as workspace from '../controllers/workspaceController.js'
import * as workItems from '../controllers/workItemController.js'
import { env } from '../config/env.js'
import { checkDatabase } from '../db/prisma.js'
import { authenticate, requirePermission as allow } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import * as schemas from '../validation/schemas.js'

export const router = Router()

// Slow down password guessing: AUTH_RATE_LIMIT failed attempts per 15 minutes per IP.
// Successful requests do not count, so switching between demo users is never blocked.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.authRateLimit,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please wait a few minutes and try again.' },
})

router.get('/health', async (_req, res) => {
  await checkDatabase()
  res.json({ status: 'ok' })
})

// --- Auth (public) ----------------------------------------------------------
router.post('/auth/register', authLimiter, validate(schemas.registerSchema), auth.register)
router.post('/auth/login', authLimiter, validate(schemas.loginSchema), auth.login)
router.post('/auth/accept-invite', authLimiter, validate(schemas.acceptInviteSchema), auth.acceptInvite)
// One-click logins for the login page. Empty unless SHOW_DEMO_ACCOUNTS is on (off in production).
router.get('/auth/demo-accounts', auth.demoAccounts)

// --- Everything below needs a valid token ---------------------------------------
router.use(authenticate)

router.post('/auth/logout', auth.logout)
router.get('/auth/me', auth.me)

// Every route below checks a permission from src/auth/permissions.js, never a role name,
// so admins can change what each role may do in Settings → Roles.

// Workspace settings: anyone can read.
router.get('/workspace', workspace.getWorkspace)
router.put('/organization', allow('organization.update'), validate(schemas.updateOrganizationSchema), workspace.updateOrganization)

router.post('/statuses', allow('statuses.manage'), validate(schemas.statusSchema), workspace.createStatus)
router.put('/statuses/:id', allow('statuses.manage'), validate(schemas.statusSchema), workspace.updateStatus)
router.delete('/statuses/:id', allow('statuses.manage'), validate(schemas.deleteStatusQuery, 'query'), workspace.deleteStatus)

router.post('/fields', allow('fields.manage'), validate(schemas.fieldSchema), workspace.createField)
router.delete('/fields/:id', allow('fields.manage'), workspace.deleteField)

// Members
router.post('/members', allow('members.create'), validate(schemas.inviteSchema), workspace.inviteMember)
router.post('/members/:id/approve', allow('members.approve'), workspace.approveMember)
router.put('/members/:id/role', allow('members.update_role'), validate(schemas.memberRoleSchema), workspace.updateMemberRole)
router.delete('/members/:id', workspace.removeMember) // checks members.remove (or members.approve for a pending sign-up)

// Roles & permissions
router.get('/permissions', allow('roles.manage'), workspace.listPermissions)
router.get('/roles', allow('roles.manage'), workspace.listRoles)
router.post('/roles', allow('roles.manage'), validate(schemas.roleSchema), workspace.createRole)
router.put('/roles/:id', allow('roles.manage'), validate(schemas.roleSchema), workspace.updateRole)
router.delete('/roles/:id', allow('roles.manage'), workspace.deleteRole)

// Projects: everyone reads the ones they can see.
router.get('/projects', projects.listProjects)
router.post('/projects', allow('projects.create'), validate(schemas.projectSchema), projects.createProject)
router.put('/projects/:id', allow('projects.update'), validate(schemas.projectSchema), projects.updateProject)
router.delete('/projects/:id', allow('projects.delete'), projects.deleteProject)

// Work items: editing rules per item live in workItemService (own items vs. 'tasks.manage_all').
router.get('/work-items', validate(schemas.listWorkItemsQuery, 'query'), workItems.listWorkItems)
router.post('/work-items', allow('tasks.create'), validate(schemas.createWorkItemSchema), workItems.createWorkItem)
router.patch('/work-items/:id', validate(schemas.updateWorkItemSchema), workItems.updateWorkItem)
router.delete('/work-items/:id', workItems.deleteWorkItem)

// Bugs: who sees and changes which bug is decided per bug in bugService (reporter, assignee,
// 'bugs.view_all', 'bugs.manage').
router.get('/bugs', validate(schemas.listBugsQuery, 'query'), bugs.listBugs)
router.get('/bugs/:id', bugs.getBug)
router.post('/bugs', allow('bugs.report'), validate(schemas.createBugSchema), bugs.createBug)
router.patch('/bugs/:id', validate(schemas.updateBugSchema), bugs.updateBug)
router.delete('/bugs/:id', bugs.deleteBug)
router.post('/bugs/:id/comments', validate(schemas.bugCommentSchema), bugs.addComment)
