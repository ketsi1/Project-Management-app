import { useState, type FormEvent } from 'react'
import { api } from '../../api'
import { errorMessage } from '../../api/ApiError'
import { useWorkspace } from '../../context/workspaceContext'
import type { Status, StatusCategory } from '../../types'
import { categoryLabels } from '../../utils/format'
import Button from '../ui/Button'
import { SelectField, TextField } from '../ui/Fields'

const categoryOptions = (Object.keys(categoryLabels) as StatusCategory[]).map((c) => ({ value: c, label: categoryLabels[c] }))

// Add, rename, recolour, reorder and delete the organization's statuses (board columns).
export default function StatusSettings({ canEdit }: { canEdit: boolean }) {
  const { workspace, reloadWorkspace } = useWorkspace()
  const statuses = workspace.statuses
  const [error, setError] = useState('')

  // Form for a new status
  const [name, setName] = useState('')
  const [category, setCategory] = useState<StatusCategory>('active')
  const [color, setColor] = useState('#6366f1')

  // Which status is being deleted, and where its items should go
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [moveToId, setMoveToId] = useState('')

  async function run(action: () => Promise<unknown>) {
    setError('')
    try {
      await action()
      await reloadWorkspace()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim()) return
    await run(() => api.createStatus({ name: name.trim(), category, color, position: statuses.length }))
    setName('')
  }

  // Swap positions with the neighbour above (-1) or below (+1).
  async function move(status: Status, direction: -1 | 1) {
    const index = statuses.findIndex((s) => s.id === status.id)
    const neighbour = statuses[index + direction]
    if (!neighbour) return
    await run(async () => {
      await api.updateStatus(status.id, { ...status, position: neighbour.position })
      await api.updateStatus(neighbour.id, { ...neighbour, position: status.position })
    })
  }

  function startDelete(status: Status) {
    setDeletingId(status.id)
    setMoveToId(statuses.find((s) => s.id !== status.id)?.id ?? '')
  }

  async function confirmDelete() {
    if (!deletingId) return
    await run(() => api.deleteStatus(deletingId, moveToId))
    setDeletingId(null)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <p className="text-sm text-slate-600">
        Each status becomes a board column. Its category tells dashboards whether items in it count as not started, active,
        done or cancelled.
      </p>

      <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
        {statuses.map((status, index) => (
          <li key={status.id} className="p-3">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="color"
                value={status.color}
                disabled={!canEdit}
                onChange={(e) => run(() => api.updateStatus(status.id, { ...status, color: e.target.value }))}
                className="h-8 w-8 cursor-pointer rounded border border-slate-300"
                aria-label="Colour"
              />
              <span className="font-medium text-slate-900">{status.name}</span>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{categoryLabels[status.category]}</span>
              {canEdit && (
                <div className="ml-auto flex gap-1">
                  <Button variant="ghost" disabled={index === 0} onClick={() => move(status, -1)} aria-label="Move up">
                    ↑
                  </Button>
                  <Button variant="ghost" disabled={index === statuses.length - 1} onClick={() => move(status, 1)} aria-label="Move down">
                    ↓
                  </Button>
                  <Button variant="dangerGhost" disabled={statuses.length <= 1} onClick={() => startDelete(status)}>
                    Delete
                  </Button>
                </div>
              )}
            </div>

            {deletingId === status.id && (
              <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg bg-red-50 p-3">
                <div className="min-w-48 flex-1">
                  <SelectField
                    label="Move its items to"
                    value={moveToId}
                    onChange={setMoveToId}
                    options={statuses.filter((s) => s.id !== status.id).map((s) => ({ value: s.id, label: s.name }))}
                  />
                </div>
                <Button variant="danger" onClick={confirmDelete}>
                  Delete status
                </Button>
                <Button variant="secondary" onClick={() => setDeletingId(null)}>
                  Cancel
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {canEdit && (
        <form onSubmit={handleAdd} className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 font-semibold text-slate-900">Add a status</h3>
          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
            <TextField label="Name" value={name} onChange={setName} placeholder="e.g. Waiting for approval" />
            <SelectField label="Category" value={category} onChange={(v) => setCategory(v as StatusCategory)} options={categoryOptions} />
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Colour</span>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="mt-1 block h-10 w-14 rounded border border-slate-300" />
            </label>
          </div>
          <Button type="submit" className="mt-4">
            Add status
          </Button>
        </form>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
