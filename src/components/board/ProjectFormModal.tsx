import { useState, type FormEvent } from 'react'
import { api } from '../../api'
import { errorMessage } from '../../api/ApiError'
import { useWorkspace } from '../../context/workspaceContext'
import type { Project } from '../../types'
import Button from '../ui/Button'
import { TextAreaField, TextField } from '../ui/Fields'
import Modal from '../ui/Modal'

interface ProjectFormModalProps {
  project: Project | null // null = create a new project
  onClose: () => void
  onSaved: (project: Project) => void
}

// Create or rename a project.
export default function ProjectFormModal({ project, onClose, onSaved }: ProjectFormModalProps) {
  const { workspace, reloadProjects } = useWorkspace()
  const word = workspace.terminology.project.toLowerCase()

  const [name, setName] = useState(project?.name ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim()) {
      setError('Please enter a name.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const input = { name: name.trim(), description }
      const saved = project ? await api.updateProject(project.id, input) : await api.createProject(input)
      await reloadProjects()
      onSaved(saved)
      onClose()
    } catch (e) {
      setError(errorMessage(e))
      setSaving(false)
    }
  }

  return (
    <Modal open title={project ? `Edit ${word}` : `New ${word}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField label="Name" value={name} onChange={setName} />
        <TextAreaField label="Description" value={description} onChange={setDescription} rows={3} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  )
}
