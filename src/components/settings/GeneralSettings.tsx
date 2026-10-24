import { useState, type FormEvent } from 'react'
import { api } from '../../api'
import { errorMessage } from '../../api/ApiError'
import { useWorkspace } from '../../context/workspaceContext'
import type { Terminology } from '../../types'
import Button from '../ui/Button'
import { TextField } from '../ui/Fields'

// Organization name and the words the organization uses for "project" and "task".
export default function GeneralSettings({ canEdit }: { canEdit: boolean }) {
  const { workspace, reloadWorkspace } = useWorkspace()
  const [name, setName] = useState(workspace.organization.name)
  const [terms, setTerms] = useState<Terminology>(workspace.terminology)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  function setTerm(key: keyof Terminology, value: string) {
    setTerms((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim() || Object.values(terms).some((t) => !t.trim())) {
      setMessage('Please fill in every field.')
      return
    }
    setSaving(true)
    try {
      await api.updateOrganization(name.trim(), terms)
      await reloadWorkspace()
      setMessage('Saved.')
    } catch (e) {
      setMessage(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-6">
      <TextField label="Organization name" value={name} onChange={setName} />

      <div>
        <h3 className="font-semibold text-slate-900">Terminology</h3>
        <p className="mt-1 text-sm text-slate-600">
          Use your organization's own words. For example, a university might say "Course" and "Activity".
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <TextField label="Project (singular)" value={terms.project} onChange={(v) => setTerm('project', v)} />
          <TextField label="Projects (plural)" value={terms.projects} onChange={(v) => setTerm('projects', v)} />
          <TextField label="Task (singular)" value={terms.task} onChange={(v) => setTerm('task', v)} />
          <TextField label="Tasks (plural)" value={terms.tasks} onChange={(v) => setTerm('tasks', v)} />
        </div>
      </div>

      {message && <p className="text-sm text-slate-700">{message}</p>}
      {canEdit && (
        <Button type="submit" loading={saving}>
          Save changes
        </Button>
      )}
    </form>
  )
}
