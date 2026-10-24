import { useState, type FormEvent } from 'react'
import { api } from '../../api'
import { errorMessage } from '../../api/ApiError'
import { useWorkspace } from '../../context/workspaceContext'
import type { FieldType } from '../../types'
import Button from '../ui/Button'
import { SelectField, TextField } from '../ui/Fields'

const typeLabels: Record<FieldType, string> = {
  text: 'Text',
  number: 'Number',
  date: 'Date',
  select: 'Dropdown',
}

// Extra fields every item in this organization can have, e.g. "Budget" or "Donor".
export default function FieldSettings({ canEdit }: { canEdit: boolean }) {
  const { workspace, reloadWorkspace } = useWorkspace()
  const [label, setLabel] = useState('')
  const [type, setType] = useState<FieldType>('text')
  const [options, setOptions] = useState('')
  const [error, setError] = useState('')

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const optionList = options
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean)
    if (!label.trim()) {
      setError('Please enter a label.')
      return
    }
    if (type === 'select' && optionList.length < 2) {
      setError('A dropdown needs at least two options, separated by commas.')
      return
    }
    setError('')
    try {
      await api.createField({ label: label.trim(), type, options: type === 'select' ? optionList : [] })
      await reloadWorkspace()
      setLabel('')
      setOptions('')
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this field? Its values will no longer be shown.')) return
    try {
      await api.deleteField(id)
      await reloadWorkspace()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      {workspace.fields.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          No custom fields yet.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {workspace.fields.map((field) => (
            <li key={field.id} className="flex items-center gap-3 p-3">
              <span className="font-medium text-slate-900">{field.label}</span>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{typeLabels[field.type]}</span>
              {field.type === 'select' && <span className="text-xs text-slate-500">{field.options.join(', ')}</span>}
              {canEdit && (
                <Button variant="dangerGhost" className="ml-auto" onClick={() => handleDelete(field.id)}>
                  Delete
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <form onSubmit={handleAdd} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="font-semibold text-slate-900">Add a field</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Label" value={label} onChange={setLabel} placeholder="e.g. Budget" />
            <SelectField
              label="Type"
              value={type}
              onChange={(v) => setType(v as FieldType)}
              options={(Object.keys(typeLabels) as FieldType[]).map((t) => ({ value: t, label: typeLabels[t] }))}
            />
          </div>
          {type === 'select' && (
            <TextField label="Options (comma separated)" value={options} onChange={setOptions} placeholder="e.g. USAID, UNICEF, Government" />
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit">Add field</Button>
        </form>
      )}
    </div>
  )
}
