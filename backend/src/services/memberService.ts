import { env } from '../config/env.ts'
import { hashPassword } from '../auth/password.ts'
import { OWNER_SLUG } from '../auth/permissions.ts'
import type { AuthContext } from '../auth/sessionStore.ts'
import { createInviteToken } from '../auth/tokens.ts'
import { isUniqueViolation, prisma } from '../db/prisma.ts'
import type { MemberStatus } from '../generated/prisma/client.ts'
import { can } from '../middleware/auth.ts'
import { Events } from '../realtime/events.ts'
import { broadcastToOrg, disconnectUser } from '../realtime/socket.ts'
import { ApiError } from '../utils/ApiError.ts'
import { newId } from '../utils/time.ts'
import type { InviteInput } from '../validation/schemas.ts'
import { permissionsForRole } from './accessControl.ts'

interface RoleSummary {
  id: string
  slug: string
  name: string
}

interface MembershipSummary {
  status: MemberStatus
  roleId: string
  role: string
}

async function findRole(organizationId: string, roleId: string): Promise<RoleSummary> {
  const role = await prisma.role.findFirst({ where: { id: roleId, organizationId }, select: { id: true, slug: true, name: true } })
  if (!role) throw ApiError.badRequest('Choose a valid role.')
  return role
}

async function findMembership(organizationId: string, userId: string): Promise<MembershipSummary> {
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { status: true, role: { select: { id: true, slug: true } } },
  })
  if (!membership) throw ApiError.notFound('Member not found.')
  return { status: membership.status, roleId: membership.role.id, role: membership.role.slug }
}

// Nobody can hand out the owner role, or a role that allows more than their own role does.
async function assertCanAssign(auth: AuthContext, role: RoleSummary): Promise<void> {
  if (role.slug === OWNER_SLUG) throw ApiError.badRequest('An organization has one owner. Choose another role.')
  if (auth.role === OWNER_SLUG) return
  const missing = (await permissionsForRole(role.id)).filter((key) => !can(auth, key))
  if (missing.length > 0) throw ApiError.forbidden(`You cannot give the ${role.name} role: it can do things your role cannot.`)
}

// The owner is untouchable, admins can only be changed by the owner, and nobody changes themselves.
function assertCanManage(auth: AuthContext, userId: string, membership: MembershipSummary, action: 'change' | 'remove'): void {
  if (userId === auth.userId) throw ApiError.badRequest(`You cannot ${action} yourself.`)
  if (membership.role === OWNER_SLUG) throw ApiError.badRequest(`The owner cannot be ${action === 'remove' ? 'removed' : 'changed'}.`)
  if (membership.role === 'admin' && auth.role !== OWNER_SLUG) throw ApiError.forbidden(`Only the owner can ${action} an admin.`)
}

export interface InvitedMember {
  id: string
  fullName: string
  email: string
  role: string
  roleId: string
  roleName: string
  activated: boolean
  inviteLink?: string
}

// Adds someone to the organization with a role.
// - With a password: the account is ready right away and they can log in with it.
// - Without: the account waits for them to choose a password through an invitation link.
//   Until an email service is wired in, the link is printed to the server log and, outside
//   production, returned to the admin so they can pass it on.
export async function inviteMember(auth: AuthContext, { fullName, email, roleId, password }: InviteInput): Promise<InvitedMember> {
  const role = await findRole(auth.organizationId, roleId)
  await assertCanAssign(auth, role)

  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) throw ApiError.conflict('This email already has an account.')

  const userId = newId()
  const invite = password ? null : createInviteToken()
  try {
    await prisma.user.create({
      data: {
        id: userId,
        fullName,
        email,
        passwordHash: password ? await hashPassword(password) : null,
        invitationToken: invite?.tokenHash ?? null,
        invitationExpiresAt: invite ? new Date(Date.now() + env.auth.inviteTtlHours * 3600 * 1000) : null,
        memberships: { create: { id: newId(), organizationId: auth.organizationId, roleId: role.id, status: 'active' } },
      },
    })
  } catch (error) {
    if (isUniqueViolation(error)) throw ApiError.conflict('This email already has an account.')
    throw error
  }

  const result: InvitedMember = { id: userId, fullName, email, role: role.slug, roleId: role.id, roleName: role.name, activated: !!password }
  if (invite) {
    const link = `${env.appUrl.replace(/\/$/, '')}/accept-invite?token=${invite.token}`
    console.info(`[invite] ${email} was invited by ${auth.user.email}. Activation link (valid ${env.auth.inviteTtlHours}h): ${link}`)
    if (!env.isProduction) result.inviteLink = link
  }

  broadcastToOrg(auth.organizationId, Events.WORKSPACE_CHANGED, { section: 'members' })
  return result
}

// Lets a pending sign-up in. Needs 'members.approve' (see routes).
export async function approveMember(auth: AuthContext, id: string): Promise<void> {
  const { count } = await prisma.organizationMember.updateMany({
    where: { userId: id, organizationId: auth.organizationId, status: 'pending' },
    data: { status: 'active' },
  })
  if (count !== 1) throw ApiError.notFound('No pending sign-up found for this person.')
  broadcastToOrg(auth.organizationId, Events.WORKSPACE_CHANGED, { section: 'members' })
}

// Gives a member another role. Their next request already uses it (permissions are read per request).
export async function updateMemberRole(auth: AuthContext, id: string, roleId: string): Promise<{ id: string; role: string; roleId: string; roleName: string }> {
  const membership = await findMembership(auth.organizationId, id)
  assertCanManage(auth, id, membership, 'change')
  const role = await findRole(auth.organizationId, roleId)
  await assertCanAssign(auth, role)

  await prisma.organizationMember.update({
    where: { organizationId_userId: { organizationId: auth.organizationId, userId: id } },
    data: { roleId: role.id },
  })
  broadcastToOrg(auth.organizationId, Events.WORKSPACE_CHANGED, { section: 'members' })
  // Their project list may change with the new role.
  broadcastToOrg(auth.organizationId, Events.PROJECTS_CHANGED, { action: 'roles' })
  return { id, role: role.slug, roleId: role.id, roleName: role.name }
}

// Removes a member, or rejects a pending sign-up.
// Removing needs 'members.remove'; rejecting a sign-up needs 'members.approve' or 'members.remove'.
export async function removeMember(auth: AuthContext, id: string): Promise<void> {
  const membership = await findMembership(auth.organizationId, id)
  const rejecting = membership.status === 'pending'
  const allowed = rejecting ? can(auth, 'members.approve') || can(auth, 'members.remove') : can(auth, 'members.remove')
  if (!allowed) throw ApiError.forbidden('Your role does not allow this.')
  if (!rejecting) assertCanManage(auth, id, membership, 'remove')

  // A user belongs to one organization, so removing them deletes the account.
  // Foreign keys unassign their work items and end their sessions.
  await prisma.user.delete({ where: { id } })
  disconnectUser(id)

  broadcastToOrg(auth.organizationId, Events.WORKSPACE_CHANGED, { section: 'members' })
  broadcastToOrg(auth.organizationId, Events.WORK_ITEMS_CHANGED, { action: 'unassigned', userId: id })
}
