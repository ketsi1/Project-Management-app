// Every endpoint pm-frontend/src/api/httpApi.ts calls, mounted under /api.
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import * as auth from '../controllers/authController.js'
import * as projects from '../controllers/projectController.js'
import * as workspace from '../controllers/workspaceController.js'
import * as workItems from '../controllers/workItemController.js'
import { env } from '../config/env.js'
import { checkDatabase } from '../db/pool.js'
import { authenticate, requireManager } from '../middleware/auth.js'
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

// --- Everything below needs a valid token ---------------------------------------
router.use(authenticate)

router.post('/auth/logout', auth.logout)
router.get('/auth/me', auth.me)

// Workspace settings: anyone can read, only owners/admins can change.
router.get('/workspace', workspace.getWorkspace)
router.put('/organization', requireManager, validate(schemas.updateOrganizationSchema), workspace.updateOrganization)

router.post('/statuses', requireManager, validate(schemas.statusSchema), workspace.createStatus)
router.put('/statuses/:id', requireManager, validate(schemas.statusSchema), workspace.updateStatus)
router.delete('/statuses/:id', requireManager, validate(schemas.deleteStatusQuery, 'query'), workspace.deleteStatus)

router.post('/fields', requireManager, validate(schemas.fieldSchema), workspace.createField)
router.delete('/fields/:id', requireManager, workspace.deleteField)

router.post('/members', requireManager, validate(schemas.inviteSchema), workspace.inviteMember)
router.post('/members/:id/approve', requireManager, workspace.approveMember)
router.delete('/members/:id', requireManager, workspace.removeMember) // also rejects a pending sign-up

// Projects: everyone reads; only owners/admins create, edit or delete (as in the UI).
router.get('/projects', projects.listProjects)
router.post('/projects', requireManager, validate(schemas.projectSchema), projects.createProject)
router.put('/projects/:id', requireManager, validate(schemas.projectSchema), projects.updateProject)
router.delete('/projects/:id', requireManager, projects.deleteProject)

// Work items: every member of the organization can manage them.
router.get('/work-items', validate(schemas.listWorkItemsQuery, 'query'), workItems.listWorkItems)
router.post('/work-items', validate(schemas.createWorkItemSchema), workItems.createWorkItem)
router.patch('/work-items/:id', validate(schemas.updateWorkItemSchema), workItems.updateWorkItem)
router.delete('/work-items/:id', workItems.deleteWorkItem)
