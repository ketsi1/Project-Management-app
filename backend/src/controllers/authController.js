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

// Who am I? Handy for checking a stored token is still valid.
export function me(req, res) {
  res.json({ user: req.auth.user, organizationId: req.auth.organizationId, role: req.auth.role })
}
