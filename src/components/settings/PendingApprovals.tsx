import { useState } from 'react'
import { api } from '../../api'
import { errorMessage } from '../../api/ApiError'
import { useWorkspace } from '../../context/workspaceContext'
import Avatar from '../ui/Avatar'
import Button from '../ui/Button'
import { Alert } from '../ui/Display'

// People who signed up themselves and wait for a manager. Used on the Approvals page
// and in Settings → Members. Renders nothing when nobody is waiting.
export default function PendingApprovals() {
  const { workspace, reloadWorkspace } = useWorkspace()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const pending = workspace.pendingMembers ?? []

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

  if (pending.length === 0) return null

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-900">
        Waiting for approval{' '}
        <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">{pending.length}</span>
      </h3>
      <p className="text-xs text-slate-500">These people signed up themselves. They cannot log in or see anything until you approve them.</p>
      {error && <Alert>{error}</Alert>}
      <ul className="divide-y divide-amber-100 overflow-hidden rounded-xl border border-amber-200 bg-amber-50/40">
        {pending.map((member) => (
          <li key={member.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap">
            <Avatar name={member.fullName} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{member.fullName}</p>
              <p className="truncate text-sm text-slate-500">{member.email}</p>
            </div>
            <div className="ml-auto flex gap-2">
              <Button size="sm" loading={busyId === member.id} onClick={() => run(member.id, () => api.approveMember(member.id))}>
                Approve
              </Button>
              <Button
                variant="dangerGhost"
                size="sm"
                disabled={busyId === member.id}
                onClick={() => {
                  if (window.confirm(`Reject ${member.fullName}'s sign-up? Their account will be deleted.`)) {
                    run(member.id, () => api.removeMember(member.id))
                  }
                }}
              >
                Reject
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
