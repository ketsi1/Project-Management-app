import type { Request, Response } from 'express'
import { authOf } from '../middleware/auth.ts'
import { param, validated } from '../middleware/validate.ts'
import * as projectService from '../services/projectService.ts'
import { projectSchema } from '../validation/schemas.ts'

export async function listProjects(req: Request, res: Response): Promise<void> {
  res.json(await projectService.listProjects(authOf(req)))
}

export async function createProject(req: Request, res: Response): Promise<void> {
  res.status(201).json(await projectService.createProject(authOf(req).organizationId, validated(req, projectSchema)))
}

export async function updateProject(req: Request, res: Response): Promise<void> {
  res.json(await projectService.updateProject(authOf(req).organizationId, param(req, 'id'), validated(req, projectSchema)))
}

export async function deleteProject(req: Request, res: Response): Promise<void> {
  await projectService.deleteProject(authOf(req).organizationId, param(req, 'id'))
  res.status(204).end()
}
