import type { Request, Response } from 'express'
import { authOf } from '../middleware/auth.ts'
import { param, validated } from '../middleware/validate.ts'
import * as bugService from '../services/bugService.ts'
import { bugCommentSchema, createBugSchema, listBugsQuery, updateBugSchema } from '../validation/schemas.ts'

export async function listBugs(req: Request, res: Response): Promise<void> {
  res.json(await bugService.listBugs(authOf(req), validated(req, listBugsQuery, 'query').projectId))
}

export async function getBug(req: Request, res: Response): Promise<void> {
  res.json(await bugService.getBug(authOf(req), param(req, 'id')))
}

export async function createBug(req: Request, res: Response): Promise<void> {
  res.status(201).json(await bugService.createBug(authOf(req), validated(req, createBugSchema)))
}

export async function updateBug(req: Request, res: Response): Promise<void> {
  res.json(await bugService.updateBug(authOf(req), param(req, 'id'), validated(req, updateBugSchema)))
}

export async function deleteBug(req: Request, res: Response): Promise<void> {
  await bugService.deleteBug(authOf(req), param(req, 'id'))
  res.status(204).end()
}

export async function addComment(req: Request, res: Response): Promise<void> {
  res.status(201).json(await bugService.addComment(authOf(req), param(req, 'id'), validated(req, bugCommentSchema)))
}
