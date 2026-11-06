import { can } from '../middleware/auth.js'
import * as memberService from '../services/memberService.js'
import * as roleService from '../services/roleService.js'
import * as workspaceService from '../services/workspaceService.js'

export async function getWorkspace(req, res) {
  const includePending = can(req.auth, 'members.approve')
  res.json(await workspaceService.getWorkspace(req.auth.organizationId, { includePending }))
}

export async function updateOrganization(req, res) {
  await workspaceService.updateOrganization(req.auth.organizationId, req.valid.body)
  res.status(204).end()
}

export async function createStatus(req, res) {
  res.status(201).json(await workspaceService.createStatus(req.auth.organizationId, req.valid.body))
}

export async function updateStatus(req, res) {
  res.json(await workspaceService.updateStatus(req.auth.organizationId, req.params.id, req.valid.body))
}

export async function deleteStatus(req, res) {
  await workspaceService.deleteStatus(req.auth.organizationId, req.params.id, req.valid.query.moveTo)
  res.status(204).end()
}

export async function createField(req, res) {
  res.status(201).json(await workspaceService.createField(req.auth.organizationId, req.valid.body))
}

export async function deleteField(req, res) {
  await workspaceService.deleteField(req.auth.organizationId, req.params.id)
  res.status(204).end()
}

export async function inviteMember(req, res) {
  res.status(201).json(await memberService.inviteMember(req.auth, req.valid.body))
}

export async function approveMember(req, res) {
  await memberService.approveMember(req.auth, req.params.id)
  res.status(204).end()
}

export async function removeMember(req, res) {
  await memberService.removeMember(req.auth, req.params.id)
  res.status(204).end()
}

export async function updateMemberRole(req, res) {
  res.json(await memberService.updateMemberRole(req.auth, req.params.id, req.valid.body.roleId))
}

// --- Roles & permissions ----------------------------------------------------------

export function listPermissions(_req, res) {
  res.json(roleService.listPermissions())
}

export async function listRoles(req, res) {
  res.json(await roleService.listRoles(req.auth.organizationId))
}

export async function createRole(req, res) {
  res.status(201).json(await roleService.createRole(req.auth, req.valid.body))
}

export async function updateRole(req, res) {
  res.json(await roleService.updateRole(req.auth, req.params.id, req.valid.body))
}

export async function deleteRole(req, res) {
  await roleService.deleteRole(req.auth, req.params.id)
  res.status(204).end()
}
