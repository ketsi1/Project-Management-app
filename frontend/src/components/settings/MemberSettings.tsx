import { useState, type FormEvent } from 'react'
import { api, usingMockApi } from '../../api'
import { errorMessage } from '../../api/ApiError'
import { useAuth } from '../../context/authContext'
import { useWorkspace } from '../../context/workspaceContext'
import type { InviteResult, Member } from '../../types'
import { cn } from '../../utils/format'
import Avatar from '../ui/Avatar'
import Button from '../ui/Button'
import { Alert } from '../ui/Display'
import { SelectField, TextField } from '../ui/Fields'
import Icon from '../ui/Icon'
import PendingApprovals from './PendingApprovals'

type Access = 'password' | 'invite'

// See who is in the organization, add people with a role, change roles and remove people.
// Every action is shown only when the logged-in person's role allows it.
export default function MemberSettings() {
  const { session, can } = useAuth()
  const { workspace, reloadWorkspace } = useWorkspace()
  const assignableRoles = workspace.roles.filter((r) => r.slug !== 'owner')
  const defaultRoleId = assignableRoles.find((r) => r.slug === 'member')?.id ?? assignableRoles[0]?.id ?? ''

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [roleId, setRoleId] = useState(defaultRoleId)
  const [access, setAccess] = useState<Access>('password')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [added, setAdded] = useState<{ member: InviteResult; password?: string } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const canChange = (member: Member) => member.role !== 'owner' && member.id !== session?.user.id

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!fullName.trim() || !email.trim()) return setError('Please enter a name and email.')
    if (access === 'password' && password.length < 8) return setError('The password must be at least 8 characters.')
    setError('')
    setSaving(true)
    try {
      const member = await api.inviteMember({ fullName, email, roleId, password: access === 'password' ? password : undefined })
      await reloadWorkspace()
      setAdded({ member, password: access === 'password' ? password : undefined })
      setCopied(false)
      setFullName('')
      setEmail('')
      setPassword('')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  async function run(id: string, action: () => Promise<void>) {
    setBusyId(id)
    setError('')
    try {
      await action()
      await reloadWorkspace()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  function handleRemove(member: Member) {
    if (!window.confirm(`Remove ${member.fullName} from the organization? Their account will be deleted.`)) return
    void run(member.id, () => api.removeMember(member.id))
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      {can('members.approve') && <PendingApprovals />}

      {error && <Alert>{error}</Alert>}

      {added && (
        <Alert
          tone="success"
          action={
            <button type="button" onClick={() => setAdded(null)} aria-label="Dismiss" className="text-emerald-700 hover:text-emerald-900">
              <Icon name="x" className="h-4 w-4" />
            </button>
          }
        >
          {added.password ? (
            <span>
              {added.member.fullName} was added as <b>{added.member.roleName}</b>. They can log in now with{' '}
              <span className="font-mono">{added.member.email}</span> and the password you set.
            </span>
          ) : added.member.inviteLink ? (
            <span className="block space-y-2">
              <span className="block">
                {added.member.fullName} was invited as <b>{added.member.roleName}</b>. Send them this link to choose a password:
              </span>
              <span className="flex items-center gap-2">
                <input readOnly value={added.member.inviteLink} className="min-w-0 flex-1 rounded-md border border-emerald-200 bg-white px-2 py-1 font-mono text-xs text-slate-700" onFocus={(e) => e.target.select()} />
                <Button size="sm" variant="secondary" onClick={() => copy(added.member.inviteLink!)}>
                  <Icon name={copied ? 'check' : 'copy'} className="h-3.5 w-3.5" />
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </span>
            </span>
          ) : (
            <span>
              {added.member.fullName} was invited as <b>{added.member.roleName}</b>.{' '}
              {usingMockApi ? 'In demo mode they log in with password123.' : 'The activation link is in the server log.'}
            </span>
          )}
        </Alert>
      )}

      <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {workspace.members.map((member) => (
          <li key={member.id} className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50/60 sm:flex-nowrap">
            <Avatar name={member.fullName} />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-slate-900">
                <span className="truncate">{member.fullName}</span>
                {member.id === session?.user.id && (
                  <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-600">You</span>
                )}
                {!member.activated && (
                  <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                    Invite not accepted
                  </span>
                )}
              </p>
              <p className="truncate text-sm text-slate-500">{member.email}</p>
            </div>

            <div className="ml-auto flex items-center gap-2">
              {can('members.update_role') && canChange(member) ? (
                <select
                  aria-label={`Role of ${member.fullName}`}
                  value={member.roleId}
                  disabled={busyId === member.id}
                  onChange={(e) => run(member.id, () => api.updateMemberRole(member.id, e.target.value))}
                  className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 shadow-card outline-none transition hover:border-slate-300 focus:border-indigo-400 focus:ring-3 focus:ring-indigo-100"
                >
                  {assignableRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span
                  className={cn(
                    'rounded-md px-2 py-0.5 text-xs font-medium',
                    member.role === 'owner' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600',
                  )}
                >
                  {member.roleName}
                </span>
              )}
              {can('members.remove') && canChange(member) && (
                <Button variant="dangerGhost" size="sm" disabled={busyId === member.id} onClick={() => handleRemove(member)}>
                  Remove
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {can('members.create') && (
        <form onSubmit={handleAdd} className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Add a member</h3>
            <p className="mt-0.5 text-xs text-slate-500">They join with the role you pick. Nobody needs to sign up.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField label="Full name" value={fullName} onChange={setFullName} />
            <TextField label="Email" type="email" value={email} onChange={setEmail} autoComplete="off" />
            <SelectField label="Role" value={roleId} onChange={setRoleId} options={assignableRoles.map((r) => ({ value: r.id, label: r.name }))} />
          </div>

          <fieldset>
            <legend className="text-[13px] font-medium text-slate-700">How they get in</legend>
            <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
              {(
                [
                  { id: 'password', icon: 'key', title: 'Set a password now', text: 'They can log in right away.' },
                  { id: 'invite', icon: 'mail', title: 'Send an invitation link', text: 'They choose their own password.' },
                ] as const
              ).map((option) => (
                <label
                  key={option.id}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-lg border bg-white p-3 transition',
                    access === option.id ? 'border-indigo-400 ring-3 ring-indigo-100' : 'border-slate-200 hover:border-slate-300',
                  )}
                >
                  <input type="radio" name="access" className="sr-only" checked={access === option.id} onChange={() => setAccess(option.id)} />
                  <Icon name={option.icon} className={cn('mt-0.5 h-4 w-4 shrink-0', access === option.id ? 'text-indigo-600' : 'text-slate-400')} />
                  <span>
                    <span className="block text-sm font-medium text-slate-900">{option.title}</span>
                    <span className="block text-xs text-slate-500">{option.text}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {access === 'password' && (
            <div className="sm:max-w-xs">
              <TextField label="Password (at least 8 characters)" type="password" value={password} onChange={setPassword} autoComplete="new-password" />
            </div>
          )}

          <Button type="submit" loading={saving}>
            <Icon name="plus" className="h-4 w-4" />
            Add member
          </Button>
        </form>
      )}
    </div>
  )
}
