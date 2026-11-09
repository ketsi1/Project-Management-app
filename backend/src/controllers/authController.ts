import type { Request, Response } from 'express'
import { authOf } from '../middleware/auth.ts'
import { validated } from '../middleware/validate.ts'
import * as authService from '../services/authService.ts'
import { acceptInviteSchema, loginSchema, registerSchema } from '../validation/schemas.ts'

const requestMeta = (req: Request): authService.RequestMeta => ({ userAgent: req.get('user-agent'), ip: req.ip })

export async function register(req: Request, res: Response): Promise<void> {
  res.status(201).json(await authService.register(validated(req, registerSchema)))
}

export async function login(req: Request, res: Response): Promise<void> {
  res.json(await authService.login(validated(req, loginSchema), requestMeta(req)))
}

export async function logout(req: Request, res: Response): Promise<void> {
  await authService.logout(authOf(req).sessionId)
  res.status(204).end()
}

export async function acceptInvite(req: Request, res: Response): Promise<void> {
  res.json(await authService.acceptInvite(validated(req, acceptInviteSchema), requestMeta(req)))
}

// Who am I, and what may I do right now? The frontend calls this to refresh permissions.
export function me(req: Request, res: Response): void {
  res.json(authService.currentSession(authOf(req)))
}

export async function demoAccounts(_req: Request, res: Response): Promise<void> {
  res.json(await authService.listDemoAccounts())
}
