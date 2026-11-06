import * as bugService from '../services/bugService.js'

export async function listBugs(req, res) {
  res.json(await bugService.listBugs(req.auth, req.valid.query.projectId))
}

export async function getBug(req, res) {
  res.json(await bugService.getBug(req.auth, req.params.id))
}

export async function createBug(req, res) {
  res.status(201).json(await bugService.createBug(req.auth, req.valid.body))
}

export async function updateBug(req, res) {
  res.json(await bugService.updateBug(req.auth, req.params.id, req.valid.body))
}

export async function deleteBug(req, res) {
  await bugService.deleteBug(req.auth, req.params.id)
  res.status(204).end()
}

export async function addComment(req, res) {
  res.status(201).json(await bugService.addComment(req.auth, req.params.id, req.valid.body))
}
