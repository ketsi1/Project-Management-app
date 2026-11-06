import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../../api'
import { errorMessage } from '../../api/ApiError'
import { useAuth } from '../../context/authContext'
import { useWorkspace } from '../../context/workspaceContext'
import type { Bug, BugInput, BugSeverity, Priority, WorkItem } from '../../types'
import { severityHints, severityLabels, severityOrder } from '../../utils/bugs'
import { cn, priorityLabels } from '../../utils/format'
import Button from '../ui/Button'
import { Alert } from '../ui/Display'
import { SelectField, TextAreaField, TextField } from '../ui/Fields'
import Modal from '../ui/Modal'

interface BugFormModalProps {
  // null = report a new bug
  bug: Bug | null
  defaultProjectId?: string
  onClose: () => void
  onSaved: (bug: Bug) => void
}

const severityDot: Record<BugSeverity, string> = {
  critical: 'bg-rose-600',
  major: 'bg-orange-500',
  minor: 'bg-amber-400',
  trivial: 'bg-slate-400',
}

// Report a bug, or edit its details. Assignee and priority are only offered to people who triage bugs.
export default function BugFormModal({ bug, defaultProjectId, onClose, onSaved }: BugFormModalProps) {
  const { can } = useAuth()
  const { workspace, projects } = useWorkspace()
  const triage = can('bugs.manage')

  const [form, setForm] = useState<BugInput>(() => ({
    projectId: bug?.projectId ?? defaultProjectId ?? projects[0]?.id ?? '',
    workItemId: bug?.workItemId ?? null,
    title: bug?.title ?? '',
    description: bug?.description ?? '',
    stepsToReproduce: bug?.stepsToReproduce ?? '',
    expectedResult: bug?.expectedResult ?? '',
    actualResult: bug?.actualResult ?? '',
    environment: bug?.environment ?? '',
    severity: bug?.severity ?? 'major',
    priority: bug?.priority ?? 'medium',
    assigneeId: bug?.assigneeId ?? null,
  }))
  const [tasks, setTasks] = useState<WorkItem[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = <K extends keyof BugInput>(key: K, value: BugInput[K]) => setForm((f) => ({ ...f, [key]: value }))

  // Tasks of the chosen project, for "Related task".
  useEffect(() => {
    if (!form.projectId) return
    let cancelled = false
    api
      .listWorkItems(form.projectId)
      .then((items) => !cancelled && setTasks(items))
      .catch(() => !cancelled && setTasks([]))
    return () => {
      cancelled = true
    }
  }, [form.projectId])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form.projectId) return setError(`Choose a ${workspace.terminology.project.toLowerCase()}.`)
    if (!form.title.trim()) return setError('Give the bug a short title.')
    setSaving(true)
    setError('')
    try {
      const input: BugInput = { ...form, title: form.title.trim() }
      // Only send what this person may change.
      if (!triage) {
        delete (input as Partial<BugInput>).assigneeId
        if (bug) delete (input as Partial<BugInput>).priority
      }
      const saved = bug ? await api.updateBug(bug.id, input) : await api.createBug(input)
      onSaved(saved)
      onClose()
    } catch (e) {
      setError(errorMessage(e))
      setSaving(false)
    }
  }

  return (
    <Modal open title={bug ? `Edit ${bug.key}` : 'Report a bug'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField label="Title" value={form.title} onChange={(v) => set('title', v)} placeholder="What is broken? e.g. “Save button does nothing”" />

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label={workspace.terminology.project}
            value={form.projectId}
            onChange={(v) => setForm((f) => ({ ...f, projectId: v, workItemId: null }))}
            options={[
              ...(form.projectId ? [] : [{ value: '', label: `Choose a ${workspace.terminology.project.toLowerCase()}…` }]),
              ...projects.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
          <SelectField
            label={`Related ${workspace.terminology.task.toLowerCase()} (optional)`}
            value={form.workItemId ?? ''}
            onChange={(v) => set('workItemId', v || null)}
            options={[{ value: '', label: 'None' }, ...tasks.map((t) => ({ value: t.id, label: t.title }))]}
          />
        </div>

        <fieldset>
          <legend className="text-[13px] font-medium text-slate-700">Severity — how bad is it?</legend>
          <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {severityOrder.map((s) => (
              <label
                key={s}
                title={severityHints[s]}
                className={cn(
                  'flex cursor-pointer flex-col gap-0.5 rounded-lg border bg-white px-3 py-2 transition',
                  form.severity === s ? 'border-indigo-400 ring-3 ring-indigo-100' : 'border-slate-200 hover:border-slate-300',
                )}
              >
                <input type="radio" name="severity" className="sr-only" checked={form.severity === s} onChange={() => set('severity', s)} />
                <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                  <span className={cn('h-2 w-2 rounded-full', severityDot[s])} />
                  {severityLabels[s]}
                </span>
                <span className="text-[11px] leading-snug text-slate-500">{severityHints[s]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {(triage || !bug) && (
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Priority"
              value={form.priority}
              onChange={(v) => set('priority', v as Priority)}
              options={(Object.keys(priorityLabels) as Priority[]).map((p) => ({ value: p, label: priorityLabels[p] }))}
            />
            {triage && (
              <SelectField
                label="Assignee"
                value={form.assigneeId ?? ''}
                onChange={(v) => set('assigneeId', v || null)}
                options={[{ value: '', label: 'Unassigned' }, ...workspace.members.map((m) => ({ value: m.id, label: m.fullName }))]}
              />
            )}
          </div>
        )}

        <TextAreaField label="Steps to reproduce" rows={4} value={form.stepsToReproduce} onChange={(v) => set('stepsToReproduce', v)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextAreaField label="Expected result" rows={2} value={form.expectedResult} onChange={(v) => set('expectedResult', v)} />
          <TextAreaField label="Actual result" rows={2} value={form.actualResult} onChange={(v) => set('actualResult', v)} />
        </div>
        <TextField label="Environment (optional)" value={form.environment} onChange={(v) => set('environment', v)} placeholder="Browser, device, app version…" />
        <TextAreaField label="More details (optional)" rows={3} value={form.description} onChange={(v) => set('description', v)} />

        {error && <Alert>{error}</Alert>}

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {bug ? 'Save changes' : 'Report bug'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
