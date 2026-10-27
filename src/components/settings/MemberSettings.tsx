import { useState, type FormEvent } from 'react'
import { api, usingMockApi } from '../../api'
import { errorMessage } from '../../api/ApiError'
import { useAuth } from '../../context/authContext'
import { useWorkspace } from '../../context/workspaceContext'
import type { Role } from '../../types'
import Avatar from '../ui/Avatar'
import Button from '../ui/Button'
import { SelectField, TextField } from '../ui/Fields'

const roleLabels: Record<Role, string> = { owner: 'Owner', admin: 'Admin', member: 'Member' }

// See who is in the organization, invite people and remove them.
export default function MemberSettings({ canEdit }: { canEdit: boolean }) {
  const { session } = useAuth()
  const { workspace, reloadWorkspace } = useWorkspace()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('member')
  const [error, setError] = useState('')

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!fullName.trim() || !email.trim()) {
      setError('Please enter a name and email.')
      return
    }
    setError('')
    try {
      await api.inviteMember({ fullName, email, role })
      await reloadWorkspace()
      setFullName('')
      setEmail('')
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  async function handleRemove(id: string, name: string) {
    if (!window.confirm(`Remove ${name} from the organization?`)) return
    try {
      await api.removeMember(id)
      await reloadWorkspace()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {workspace.members.map((member) => (
          <li key={member.id} className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50/60 sm:flex-nowrap">
            <Avatar name={member.fullName} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">
                {member.fullName}
                {member.id === session?.user.id && <span className="ml-2 rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-600">You</span>}
              </p>
              <p className="truncate text-sm text-slate-500">{member.email}</p>
            </div>
            <span className="ml-auto rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{roleLabels[member.role]}</span>
            {canEdit && member.role !== 'owner' && (
              <Button variant="dangerGhost" size="sm" onClick={() => handleRemove(member.id, member.fullName)}>
                Remove
              </Button>
            )}
          </li>
        ))}
      </ul>

      {canEdit && (
        <form onSubmit={handleInvite} className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-slate-900">Invite a member</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField label="Full name" value={fullName} onChange={setFullName} />
            <TextField label="Email" type="email" value={email} onChange={setEmail} />
            <SelectField
              label="Role"
              value={role}
              onChange={(v) => setRole(v as Role)}
              options={[
                { value: 'member', label: 'Member' },
                { value: 'admin', label: 'Admin' },
              ]}
            />
          </div>
          {usingMockApi && (
            <p className="text-xs text-slate-500">
              Demo mode: invited people appear in lists and can be assigned work, but cannot log in until the real backend sends invitation emails.
            </p>
          )}
          {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
          <Button type="submit">Invite</Button>
        </form>
      )}
    </div>
  )
}
