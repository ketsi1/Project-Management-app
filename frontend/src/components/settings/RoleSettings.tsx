import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { api } from '../../api'
import { errorMessage } from '../../api/ApiError'
import { useAuth } from '../../context/authContext'
import { useWorkspace } from '../../context/workspaceContext'
import type { Permission, PermissionInfo, RoleDetail } from '../../types'
import { cn } from '../../utils/format'
import Button from '../ui/Button'
import { Alert, LoadingState } from '../ui/Display'
import { TextAreaField, TextField } from '../ui/Fields'
import Icon from '../ui/Icon'

type Draft = { id: string | null; name: string; description: string; permissions: Permission[] }

const emptyDraft: Draft = { id: null, name: '', description: '', permissions: [] }
const toDraft = (role: RoleDetail): Draft => ({ id: role.id, name: role.name, description: role.description, permissions: role.permissions })

// Create roles and choose which permissions each one has.
export default function RoleSettings() {
  const { session } = useAuth()
  const { reloadWorkspace } = useWorkspace()
  const [roles, setRoles] = useState<RoleDetail[] | null>(null)
  const [catalog, setCatalog] = useState<PermissionInfo[]>([])
  const [selectedId, setSelectedId] = useState<string | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    const [loadedRoles, loadedCatalog] = await Promise.all([api.listRoles(), api.listPermissions()])
    setRoles(loadedRoles)
    setCatalog(loadedCatalog)
    return loadedRoles
  }, [])

  useEffect(() => {
    load()
      .then((loaded) => {
        // Open the first role this person can actually edit.
        const first = loaded.find((r) => !r.locked && (r.slug !== session?.role || session?.role === 'owner')) ?? loaded[0]
        if (first) {
          setSelectedId(first.id)
          setDraft(toDraft(first))
        }
      })
      .catch((e) => setError(errorMessage(e)))
    // Only on first load; the role list is reloaded by load() after each change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load])

  const groups = useMemo(() => {
    const byGroup = new Map<string, PermissionInfo[]>()
    catalog.forEach((p) => byGroup.set(p.group, [...(byGroup.get(p.group) ?? []), p]))
    return [...byGroup.entries()]
  }, [catalog])

  const selected = roles?.find((r) => r.id === selectedId) ?? null
  const isNew = selectedId === 'new'
  const isOwnRole = !!selected && selected.slug === session?.role && session?.role !== 'owner'
  const readOnly = !isNew && (!selected || selected.locked || isOwnRole)
  const dirty = isNew || (!!selected && JSON.stringify(toDraft(selected)) !== JSON.stringify({ ...draft, permissions: [...draft.permissions].sort() }))

  function select(role: RoleDetail | 'new') {
    setError('')
    setNotice('')
    if (role === 'new') {
      setSelectedId('new')
      setDraft(emptyDraft)
    } else {
      setSelectedId(role.id)
      setDraft(toDraft(role))
    }
  }

  function toggle(keys: Permission[], on: boolean) {
    setDraft((d) => {
      const set = new Set(d.permissions)
      keys.forEach((k) => (on ? set.add(k) : set.delete(k)))
      return { ...d, permissions: [...set].sort() }
    })
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft.name.trim()) return setError('Give the role a name.')
    setSaving(true)
    setError('')
    try {
      const input = { name: draft.name.trim(), description: draft.description.trim(), permissions: draft.permissions }
      const saved = isNew ? await api.createRole(input) : await api.updateRole(draft.id!, input)
      await Promise.all([load(), reloadWorkspace()])
      setSelectedId(saved.id)
      setDraft(toDraft(saved))
      setNotice(isNew ? `Role “${saved.name}” created.` : 'Saved. Everyone with this role has the new permissions now.')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!selected || !window.confirm(`Delete the “${selected.name}” role?`)) return
    setSaving(true)
    setError('')
    try {
      await api.deleteRole(selected.id)
      const loaded = await load()
      await reloadWorkspace()
      select(loaded.find((r) => !r.locked) ?? loaded[0])
      setNotice('Role deleted.')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  if (!roles) return error ? <Alert>{error}</Alert> : <LoadingState label="Loading roles…" />

  return (
    <div className="grid gap-6 xl:grid-cols-[16rem_1fr]">
      {/* Role list */}
      <div className="space-y-2">
        <ul className="space-y-1.5" aria-label="Roles">
          {roles.map((role) => {
            const active = role.id === selectedId
            return (
              <li key={role.id}>
                <button
                  type="button"
                  onClick={() => select(role)}
                  aria-current={active || undefined}
                  className={cn(
                    'w-full rounded-lg border px-3 py-2.5 text-left transition',
                    active ? 'border-indigo-300 bg-indigo-50/60 ring-2 ring-indigo-500/10' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Icon name={role.locked ? 'lock' : 'shield'} className={cn('h-4 w-4 shrink-0', active ? 'text-indigo-600' : 'text-slate-400')} />
                    <span className="flex-1 truncate text-sm font-semibold text-slate-900">{role.name}</span>
                    {role.isSystem && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Built-in</span>}
                  </span>
                  <span className="mt-1 block pl-6 text-xs text-slate-500">
                    {role.memberCount} {role.memberCount === 1 ? 'member' : 'members'} · {role.locked ? 'all' : role.permissions.length} permissions
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <Button variant="secondary" className="w-full" onClick={() => select('new')}>
          <Icon name="plus" className="h-4 w-4" />
          New role
        </Button>
      </div>

      {/* Editor */}
      <form onSubmit={handleSave} className="min-w-0 space-y-5">
        {error && <Alert>{error}</Alert>}
        {notice && !error && <Alert tone="success">{notice}</Alert>}

        {selected?.locked && (
          <p className="flex items-start gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-800 ring-1 ring-inset ring-indigo-200">
            <Icon name="lock" className="mt-0.5 h-4 w-4 shrink-0" />
            The owner always has every permission. This role cannot be changed.
          </p>
        )}
        {isOwnRole && (
          <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
            <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
            This is your own role. Ask the owner to change it, so nobody locks themselves out.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Role name" value={draft.name} onChange={(name) => setDraft((d) => ({ ...d, name }))} disabled={readOnly} placeholder="e.g. QA Lead" />
          <TextAreaField label="Description" rows={1} value={draft.description} onChange={(description) => setDraft((d) => ({ ...d, description }))} disabled={readOnly} />
        </div>

        <div className="space-y-4">
          {groups.map(([group, permissions]) => {
            const keys = permissions.map((p) => p.key)
            const granted = selected?.locked ? keys.length : keys.filter((k) => draft.permissions.includes(k)).length
            return (
              <fieldset key={group} className="overflow-hidden rounded-xl border border-slate-200">
                <legend className="sr-only">{group}</legend>
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
                  <span className="text-sm font-semibold text-slate-900">
                    {group} <span className="ml-1 text-xs font-medium text-slate-400 tabular-nums">{granted}/{keys.length}</span>
                  </span>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => toggle(keys, granted < keys.length)}
                      className="text-xs font-semibold text-indigo-600 transition-colors hover:text-indigo-800"
                    >
                      {granted < keys.length ? 'Select all' : 'Clear'}
                    </button>
                  )}
                </div>
                <ul className="divide-y divide-slate-100">
                  {permissions.map((p) => {
                    const checked = selected?.locked || draft.permissions.includes(p.key)
                    return (
                      <li key={p.key}>
                        <label className={cn('flex items-start gap-3 px-4 py-3', readOnly ? 'cursor-default' : 'cursor-pointer hover:bg-slate-50/70')}>
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-indigo-600"
                            checked={checked}
                            disabled={readOnly}
                            onChange={(e) => toggle([p.key], e.target.checked)}
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-slate-900">{p.name}</span>
                            <span className="block text-xs leading-relaxed text-slate-500">{p.description}</span>
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </fieldset>
            )
          })}
        </div>

        {!readOnly && (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <Button type="submit" loading={saving} disabled={!dirty}>
              {isNew ? 'Create role' : 'Save changes'}
            </Button>
            {selected && !isNew && (
              <Button variant="ghost" disabled={!dirty || saving} onClick={() => setDraft(toDraft(selected))}>
                Undo changes
              </Button>
            )}
            {selected && !isNew && !selected.isSystem && (
              <Button
                variant="dangerGhost"
                className="ml-auto"
                disabled={saving || selected.memberCount > 0}
                title={selected.memberCount > 0 ? 'Give its members another role first' : undefined}
                onClick={handleDelete}
              >
                <Icon name="trash" className="h-3.5 w-3.5" />
                Delete role
              </Button>
            )}
          </div>
        )}
      </form>
    </div>
  )
}
