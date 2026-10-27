import { useState } from 'react'
import FieldSettings from '../components/settings/FieldSettings'
import GeneralSettings from '../components/settings/GeneralSettings'
import MemberSettings from '../components/settings/MemberSettings'
import StatusSettings from '../components/settings/StatusSettings'
import Icon, { type IconName } from '../components/ui/Icon'
import { useAuth } from '../context/authContext'
import { cn } from '../utils/format'

const tabs: ReadonlyArray<{ id: 'general' | 'statuses' | 'fields' | 'members'; label: string; icon: IconName; description: string }> = [
  { id: 'general', label: 'General', icon: 'settings', description: 'Organization name and the words your team uses.' },
  { id: 'statuses', label: 'Statuses', icon: 'board', description: 'The columns work moves through on every board.' },
  { id: 'fields', label: 'Custom fields', icon: 'list', description: 'Extra details every task can carry.' },
  { id: 'members', label: 'Members', icon: 'users', description: 'Who is in the organization and what they can do.' },
]

type TabId = (typeof tabs)[number]['id']

// Where an organization customizes the tool to its own way of working.
export default function SettingsPage() {
  const { session } = useAuth()
  const [tab, setTab] = useState<TabId>('general')
  const canEdit = session?.role === 'owner' || session?.role === 'admin'
  const current = tabs.find((t) => t.id === tab)!

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Shape the workspace around how your organization works.</p>
        {!canEdit && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
            <Icon name="alert" className="h-4 w-4" />
            Only owners and admins can change settings. You can view them.
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[13rem_1fr]">
        {/* Tabs: horizontal strip on small screens, vertical list on large */}
        <nav className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="Settings sections">
          <div className="flex gap-1 border-b border-slate-200 lg:flex-col lg:border-b-0" role="tablist">
            {tabs.map((t) => {
              const selected = tab === t.id
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
                  {t.label}
                </button>
              )
            })}
          </div>
        </nav>

        <section key={tab} className="surface min-w-0 p-4 animate-fade-in-up sm:p-6">
          <div className="mb-6 border-b border-slate-100 pb-4">
            <h2 className="text-base font-semibold text-slate-900">{current.label}</h2>
            <p className="mt-0.5 text-sm text-slate-500">{current.description}</p>
          </div>
          {tab === 'general' && <GeneralSettings canEdit={canEdit} />}
          {tab === 'statuses' && <StatusSettings canEdit={canEdit} />}
          {tab === 'fields' && <FieldSettings canEdit={canEdit} />}
          {tab === 'members' && <MemberSettings canEdit={canEdit} />}
        </section>
      </div>
    </div>
  )
}
