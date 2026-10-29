import PendingApprovals from '../components/settings/PendingApprovals'
import { EmptyState } from '../components/ui/Display'
import { useWorkspace } from '../context/workspaceContext'

// Manager-only: approve or reject people who signed up themselves.
export default function ApprovalsPage() {
  const { workspace } = useWorkspace()
  const waiting = workspace.pendingMembers?.length ?? 0

  return (
    <div className="max-w-3xl space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Approvals</h1>
        <p className="mt-1 text-sm text-slate-500">
          New sign-ups join as employees but cannot log in or see anything until a manager approves them.
        </p>
      </div>
      {waiting === 0 ? (
        <div className="surface">
          <EmptyState icon="checkCircle" title="No one is waiting" description="New sign-ups will appear here for you to approve." />
        </div>
      ) : (
        <PendingApprovals />
      )}
    </div>
  )
}
