import { useState } from 'react'
import FieldSettings from '../components/settings/FieldSettings'
import GeneralSettings from '../components/settings/GeneralSettings'
import MemberSettings from '../components/settings/MemberSettings'
import StatusSettings from '../components/settings/StatusSettings'
import { useAuth } from '../context/authContext'
import { cn } from '../utils/format'

const tabs = [
  { id: 'general', label: 'General' },
  { id: 'statuses', label: 'Statuses' },
  { id: 'fields', label: 'Custom fields' },
  { id: 'members', label: 'Members' },
] as const

type TabId = (typeof tabs)[number]['id']

// Where an organization customizes the tool to its own way of working.
export default function SettingsPage() {
  const { session } = useAuth()
  const [tab, setTab] = useState<TabId>('general')
  const canEdit = session?.role === 'owner' || session?.role === 'admin'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        {!canEdit && <p className="mt-1 text-sm text-amber-700">Only owners and admins can change settings. You can view them.</p>}
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              '-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm',
              tab === t.id ? 'border-blue-600 font-medium text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-900',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'general' && <GeneralSettings canEdit={canEdit} />}
      {tab === 'statuses' && <StatusSettings canEdit={canEdit} />}
      {tab === 'fields' && <FieldSettings canEdit={canEdit} />}
      {tab === 'members' && <MemberSettings canEdit={canEdit} />}
    </div>
  )
}
