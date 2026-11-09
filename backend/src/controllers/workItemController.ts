import type { Request, Response } from 'express'
import { authOf } from '../middleware/auth.ts'
import { param, validated } from '../middleware/validate.ts'
import * as workItemService from '../services/workItemService.ts'
import { createWorkItemSchema, listWorkItemsQuery, updateWorkItemSchema } from '../validation/schemas.ts'

export async function listWorkItems(req: Request, res: Response): Promise<void> {
  res.json(await workItemService.listWorkItems(authOf(req), validated(req, listWorkItemsQuery, 'query').projectId))
}

export async function createWorkItem(req: Request, res: Response): Promise<void> {
  res.status(201).json(await workItemService.createWorkItem(authOf(req), validated(req, createWorkItemSchema)))
}

export async function updateWorkItem(req: Request, res: Response): Promise<void> {
  res.json(await workItemService.updateWorkItem(authOf(req), param(req, 'id'), validated(req, updateWorkItemSchema)))
}

export async function deleteWorkItem(req: Request, res: Response): Promise<void> {
  await workItemService.deleteWorkItem(authOf(req), param(req, 'id'))
  res.status(204).end()
}
