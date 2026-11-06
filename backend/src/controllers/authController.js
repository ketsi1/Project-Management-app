import * as authService from '../services/authService.js'

const requestMeta = (req) => ({ userAgent: req.get('user-agent'), ip: req.ip })

export async function register(req, res) {
  res.status(201).json(await authService.register(req.valid.body))
}

export async function login(req, res) {
  res.json(await authService.login(req.valid.body, requestMeta(req)))
}

export async function logout(req, res) {
  await authService.logout(req.auth.sessionId)
  res.status(204).end()
}

export async function acceptInvite(req, res) {
  res.json(await authService.acceptInvite(req.valid.body, requestMeta(req)))
}

// Who am I, and what may I do right now? The frontend calls this to refresh permissions.
export function me(req, res) {
  res.json(authService.currentSession(req.auth))
}

export async function demoAccounts(_req, res) {
  res.json(await authService.listDemoAccounts())
}
