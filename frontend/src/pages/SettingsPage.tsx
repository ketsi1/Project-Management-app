import { useState } from 'react'
import FieldSettings from '../components/settings/FieldSettings'
import GeneralSettings from '../components/settings/GeneralSettings'
import MemberSettings from '../components/settings/MemberSettings'
import RoleSettings from '../components/settings/RoleSettings'
import StatusSettings from '../components/settings/StatusSettings'
import Icon, { type IconName } from '../components/ui/Icon'
import { useAuth } from '../context/authContext'
import type { Permission } from '../types'
import { cn } from '../utils/format'

type TabId = 'general' | 'statuses' | 'fields' | 'members' | 'roles'

// Each tab says which permission lets someone change it. Tabs marked `hidden` are not shown at
// all without that permission; the others can still be viewed read-only.
const tabs: ReadonlyArray<{ id: TabId; label: string; icon: IconName; description: string; edit: Permission[]; hidden?: boolean }> = [
  { id: 'general', label: 'General', icon: 'settings', description: 'Organization name and the words your team uses.', edit: ['organization.update'] },
  { id: 'statuses', label: 'Statuses', icon: 'board', description: 'The columns work moves through on every board.', edit: ['statuses.manage'] },
  { id: 'fields', label: 'Custom fields', icon: 'list', description: 'Extra details every task can carry.', edit: ['fields.manage'] },
  {
    id: 'members',
    label: 'Members',
    icon: 'users',
    description: 'Who is in the organization and which role they have.',
    edit: ['members.create', 'members.update_role', 'members.remove', 'members.approve'],
  },
  {
    id: 'roles',
    label: 'Roles & permissions',
    icon: 'shield',
    description: 'What each role is allowed to do. Changes apply to everyone with that role right away.',
    edit: ['roles.manage'],
    hidden: true,
  },
]

// Where an organization customizes the tool to its own way of working.
export default function SettingsPage() {
  const { canAny } = useAuth()
  const visibleTabs = tabs.filter((t) => !t.hidden || canAny(...t.edit))
  const [tab, setTab] = useState<TabId>(() => visibleTabs.find((t) => canAny(...t.edit))?.id ?? 'general')
  const current = visibleTabs.find((t) => t.id === tab) ?? visibleTabs[0]
  const canEdit = canAny(...current.edit)

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Shape the workspace around how your organization works.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[14rem_1fr]">
        {/* Tabs: horizontal strip on small screens, vertical list on large */}
        <nav className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="Settings sections">
          <div className="flex gap-1 border-b border-slate-200 lg:flex-col lg:border-b-0" role="tablist">
            {visibleTabs.map((t) => {
              const selected = current.id === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'relative flex items-center gap-2 whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-colors lg:rounded-lg',
                    selected
                      ? 'text-indigo-700 after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-indigo-600 lg:bg-white lg:shadow-card lg:ring-1 lg:ring-slate-200 lg:after:hidden'
                      : 'text-slate-500 hover:text-slate-900 lg:hover:bg-slate-100',
                  )}
                >
                  <Icon name={t.icon} className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left">{t.label}</span>
                  {!canAny(...t.edit) && <Icon name="lock" className="h-3.5 w-3.5 text-slate-300" aria-label="View only" />}
                </button>
              )
            })}
          </div>
        </nav>

        <section key={current.id} className="surface min-w-0 p-4 animate-fade-in-up sm:p-6">
          <div className="mb-6 border-b border-slate-100 pb-4">
            <h2 className="text-base font-semibold text-slate-900">{current.label}</h2>
            <p className="mt-0.5 text-sm text-slate-500">{current.description}</p>
            {!canEdit && (
              <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
                <Icon name="lock" className="h-4 w-4" />
                Your role can view this section but not change it.
              </p>
            )}
          </div>
          {current.id === 'general' && <GeneralSettings canEdit={canEdit} />}
          {current.id === 'statuses' && <StatusSettings canEdit={canEdit} />}
          {current.id === 'fields' && <FieldSettings canEdit={canEdit} />}
          {current.id === 'members' && <MemberSettings />}
          {current.id === 'roles' && <RoleSettings />}
        </section>
      </div>
    </div>
  )
}
