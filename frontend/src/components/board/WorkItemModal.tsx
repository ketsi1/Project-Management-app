import { useState, type FormEvent } from 'react'
import { api } from '../../api'
import { errorMessage } from '../../api/ApiError'
import { useAuth } from '../../context/authContext'
import { useWorkspace } from '../../context/workspaceContext'
import type { CustomField, Priority, WorkItem } from '../../types'
import { priorityLabels } from '../../utils/format'
import { taskAccess } from '../../utils/permissions'
import Button from '../ui/Button'
import { SelectField, TextAreaField, TextField } from '../ui/Fields'
import Modal from '../ui/Modal'

interface WorkItemModalProps {
  projectId: string
  item: WorkItem | null // null = create a new item
  defaultStatusId: string
  onClose: () => void
  onSaved: () => void
}

// Create or edit one work item, including the organization's custom fields.
// The parent gives this component a new `key` each time it opens, so the form
// always starts fresh with the right values.
export default function WorkItemModal({ projectId, item, defaultStatusId, onClose, onSaved }: WorkItemModalProps) {
  const { workspace, projects } = useWorkspace()
  const { session, isManager } = useAuth()
  const { statuses, members, fields, terminology } = workspace
  // Employees can only change the status of a manager's task, and only look at a teammate's.
  const access = taskAccess(item, session, isManager)
  const locked = access !== 'full'
  const task = terminology.task.toLowerCase()

  // Every task belongs to exactly one project.
  const [selectedProjectId, setSelectedProjectId] = useState(item?.projectId ?? projectId)
  const [title, setTitle] = useState(item?.title ?? '')
  const [description, setDescription] = useState(item?.description ?? '')
  const [statusId, setStatusId] = useState(item?.statusId ?? defaultStatusId)
  const [priority, setPriority] = useState<Priority>(item?.priority ?? 'medium')
  const [assigneeId, setAssigneeId] = useState(item?.assigneeId ?? '')
  const [dueDate, setDueDate] = useState(item?.dueDate ?? '')
  const [customValues, setCustomValues] = useState<Record<string, string>>(item?.customValues ?? {})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function setCustomValue(fieldId: string, value: string) {
    setCustomValues((current) => ({ ...current, [fieldId]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (access === 'view') return
    if (!title.trim()) {
      setError('Please enter a title.')
      return
    }
    if (!selectedProjectId) {
      setError(`Please choose a ${terminology.project.toLowerCase()}.`)
      return
    }

    const data = {
      projectId: selectedProjectId,
      title: title.trim(),
      description,
      statusId,
      priority,
      assigneeId: assigneeId || null,
      dueDate: dueDate || null,
      customValues,
    }

    setSaving(true)
    setError('')
    try {
      // On a manager's task an employee may only change the status, so send just that.
      if (item && access === 'status') await api.updateWorkItem(item.id, { statusId })
      else if (item) await api.updateWorkItem(item.id, data)
      else await api.createWorkItem(data)
      onSaved()
      onClose()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!item || !window.confirm(`Delete this ${terminology.task.toLowerCase()}?`)) return
    setSaving(true)
    try {
      await api.deleteWorkItem(item.id)
      onSaved()
      onClose()
    } catch (e) {
      setError(errorMessage(e))
      setSaving(false)
    }
  }

  return (
    <Modal open title={!item ? `New ${task}` : access === 'view' ? `View ${task}` : `Edit ${task}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {access === 'status' && (
          <p className="rounded-lg bg-indigo-50 px-3 py-2 text-[13px] text-indigo-800">
            A manager created this {task}. You can update its status; ask a manager to change anything else.
          </p>
        )}
        {access === 'view' && (
          <p className="rounded-lg bg-slate-100 px-3 py-2 text-[13px] text-slate-600">
            This {task} is assigned to a teammate, so you can only view it.
          </p>
        )}
        <SelectField
          label={terminology.project}
          disabled={locked}
          value={selectedProjectId}
          onChange={setSelectedProjectId}
          options={[
            ...(selectedProjectId ? [] : [{ value: '', label: `Choose a ${terminology.project.toLowerCase()}…` }]),
            ...projects.map((p) => ({ value: p.id, label: p.name })),
          ]}
        />
        <TextField label="Title" value={title} onChange={setTitle} disabled={locked} />
        <TextAreaField label="Description" value={description} onChange={setDescription} rows={3} disabled={locked} />

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Status"
            value={statusId}
            disabled={access === 'view'}
            onChange={setStatusId}
            options={statuses.map((s) => ({ value: s.id, label: s.name }))}
          />
          <SelectField
            label="Priority"
            value={priority}
            disabled={locked}
            onChange={(value) => setPriority(value as Priority)}
            options={(Object.keys(priorityLabels) as Priority[]).map((p) => ({ value: p, label: priorityLabels[p] }))}
          />
          <SelectField
            label="Assignee"
            value={assigneeId}
            disabled={locked}
            onChange={setAssigneeId}
            options={[{ value: '', label: 'Unassigned' }, ...members.map((m) => ({ value: m.id, label: m.fullName }))]}
          />
          <TextField label="Due date" type="date" value={dueDate} onChange={setDueDate} disabled={locked} />
        </div>

        {fields.length > 0 && (
          <div className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
            <p className="eyebrow sm:col-span-2">Custom fields</p>
            {fields.map((field) => (
              <CustomFieldInput
                key={field.id}
                field={field}
                value={customValues[field.id] ?? ''}
                onChange={(value) => setCustomValue(field.id, value)}
                disabled={locked}
              />
            ))}
          </div>
        )}

        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          {item && access === 'full' ? (
            <Button type="button" variant="dangerGhost" onClick={handleDelete} className="sm:-ml-2">
              Delete
            </Button>
          ) : (
            <span className="hidden sm:block" />
          )}
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button type="button" variant="secondary" onClick={onClose} className={access === 'view' ? 'col-span-2' : undefined}>
              {access === 'view' ? 'Close' : 'Cancel'}
            </Button>
            {access !== 'view' && (
              <Button type="submit" loading={saving}>
                Save
              </Button>
            )}
          </div>
        </div>
      </form>
    </Modal>
  )
}

// Shows the right kind of input for each custom field type.
function CustomFieldInput({
  field,
  value,
  onChange,
  disabled,
}: {
  field: CustomField
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  if (field.type === 'select') {
    return (
      <SelectField
        label={field.label}
        value={value}
        onChange={onChange}
        disabled={disabled}
        options={[{ value: '', label: '—' }, ...field.options.map((o) => ({ value: o, label: o }))]}
      />
    )
  }
  return <TextField label={field.label} type={field.type} value={value} onChange={onChange} disabled={disabled} />
}
