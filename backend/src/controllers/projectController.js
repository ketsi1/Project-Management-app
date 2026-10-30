import * as projectService from '../services/projectService.js'

export async function listProjects(req, res) {
  res.json(await projectService.listProjects(req.auth))
}

export async function createProject(req, res) {
  res.status(201).json(await projectService.createProject(req.auth.organizationId, req.valid.body))
}

export async function updateProject(req, res) {
  res.json(await projectService.updateProject(req.auth.organizationId, req.params.id, req.valid.body))
}

export async function deleteProject(req, res) {
  await projectService.deleteProject(req.auth.organizationId, req.params.id)
  res.status(204).end()
}
