import * as workItemService from '../services/workItemService.js'

export async function listWorkItems(req, res) {
  res.json(await workItemService.listWorkItems(req.auth, req.valid.query.projectId))
}

export async function createWorkItem(req, res) {
  res.status(201).json(await workItemService.createWorkItem(req.auth, req.valid.body))
}

export async function updateWorkItem(req, res) {
  res.json(await workItemService.updateWorkItem(req.auth, req.params.id, req.valid.body))
}

export async function deleteWorkItem(req, res) {
  await workItemService.deleteWorkItem(req.auth, req.params.id)
  res.status(204).end()
}
