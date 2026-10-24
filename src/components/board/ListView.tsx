import type { CustomField, Member, Status, WorkItem } from '../../types'
import { cn, formatDate, isOverdue, priorityLabels, priorityStyles } from '../../utils/format'
import Avatar from '../ui/Avatar'

interface ListViewProps {
  items: WorkItem[]
  statuses: Status[]
  members: Member[]
  fields: CustomField[]
  onOpen: (item: WorkItem) => void
}

// A table of all items, including one column per custom field.
export default function ListView({ items, statuses, members, fields, onOpen }: ListViewProps) {
  if (items.length === 0) {
    return <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">Nothing here yet.</p>
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Title</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Priority</th>
            <th className="px-4 py-3">Assignee</th>
            <th className="px-4 py-3">Due</th>
            {fields.map((field) => (
              <th key={field.id} className="px-4 py-3">
                {field.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const status = statuses.find((s) => s.id === item.statusId)
            const assignee = members.find((m) => m.id === item.assigneeId)
            return (
              <tr
                key={item.id}
                onClick={() => onOpen(item)}
                className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
              >
                <td className="px-4 py-3 font-medium text-slate-900">{item.title}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-2 text-slate-700">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: status?.color }} />
                    {status?.name ?? '—'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={cn('rounded px-2 py-0.5 text-xs font-medium', priorityStyles[item.priority])}>
                    {priorityLabels[item.priority]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {assignee ? (
                    <span className="inline-flex items-center gap-2 text-slate-700">
                      <Avatar name={assignee.fullName} size="sm" />
                      {assignee.fullName}
                    </span>
                  ) : (
                    <span className="text-slate-400">Unassigned</span>
                  )}
                </td>
                <td className={cn('px-4 py-3', isOverdue(item, statuses) ? 'font-semibold text-red-600' : 'text-slate-600')}>
                  {formatDate(item.dueDate)}
                </td>
                {fields.map((field) => (
                  <td key={field.id} className="px-4 py-3 text-slate-600">
                    {item.customValues[field.id] || '—'}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
