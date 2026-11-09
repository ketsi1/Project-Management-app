import type { Request, Response } from 'express'
import { authOf, can } from '../middleware/auth.ts'
import { param, validated } from '../middleware/validate.ts'
import * as memberService from '../services/memberService.ts'
import * as roleService from '../services/roleService.ts'
import * as workspaceService from '../services/workspaceService.ts'
import {
  deleteStatusQuery,
  fieldSchema,
  inviteSchema,
  memberRoleSchema,
  roleSchema,
  statusSchema,
  updateOrganizationSchema,
} from '../validation/schemas.ts'

export async function getWorkspace(req: Request, res: Response): Promise<void> {
  const auth = authOf(req)
  const includePending = can(auth, 'members.approve')
  res.json(await workspaceService.getWorkspace(auth.organizationId, { includePending }))
}

export async function updateOrganization(req: Request, res: Response): Promise<void> {
  await workspaceService.updateOrganization(authOf(req).organizationId, validated(req, updateOrganizationSchema))
  res.status(204).end()
}

export async function createStatus(req: Request, res: Response): Promise<void> {
  res.status(201).json(await workspaceService.createStatus(authOf(req).organizationId, validated(req, statusSchema)))
}

export async function updateStatus(req: Request, res: Response): Promise<void> {
  res.json(await workspaceService.updateStatus(authOf(req).organizationId, param(req, 'id'), validated(req, statusSchema)))
}

export async function deleteStatus(req: Request, res: Response): Promise<void> {
  const { moveTo } = validated(req, deleteStatusQuery, 'query')
  await workspaceService.deleteStatus(authOf(req).organizationId, param(req, 'id'), moveTo)
  res.status(204).end()
}

export async function createField(req: Request, res: Response): Promise<void> {
  res.status(201).json(await workspaceService.createField(authOf(req).organizationId, validated(req, fieldSchema)))
}

export async function deleteField(req: Request, res: Response): Promise<void> {
  await workspaceService.deleteField(authOf(req).organizationId, param(req, 'id'))
  res.status(204).end()
}

export async function inviteMember(req: Request, res: Response): Promise<void> {
  res.status(201).json(await memberService.inviteMember(authOf(req), validated(req, inviteSchema)))
}

export async function approveMember(req: Request, res: Response): Promise<void> {
  await memberService.approveMember(authOf(req), param(req, 'id'))
  res.status(204).end()
}

export async function removeMember(req: Request, res: Response): Promise<void> {
  await memberService.removeMember(authOf(req), param(req, 'id'))
  res.status(204).end()
}

export async function updateMemberRole(req: Request, res: Response): Promise<void> {
  res.json(await memberService.updateMemberRole(authOf(req), param(req, 'id'), validated(req, memberRoleSchema).roleId))
}

// --- Roles & permissions ----------------------------------------------------------

export function listPermissions(_req: Request, res: Response): void {
  res.json(roleService.listPermissions())
}

export async function listRoles(req: Request, res: Response): Promise<void> {
  res.json(await roleService.listRoles(authOf(req).organizationId))
}

export async function createRole(req: Request, res: Response): Promise<void> {
  res.status(201).json(await roleService.createRole(authOf(req), validated(req, roleSchema)))
}

export async function updateRole(req: Request, res: Response): Promise<void> {
  res.json(await roleService.updateRole(authOf(req), param(req, 'id'), validated(req, roleSchema)))
}

export async function deleteRole(req: Request, res: Response): Promise<void> {
  await roleService.deleteRole(authOf(req), param(req, 'id'))
  res.status(204).end()
}
