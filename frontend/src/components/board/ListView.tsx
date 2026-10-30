import type { CustomField, Member, Status, WorkItem } from '../../types'
import { pressable } from '../../utils/a11y'
import { cn, formatDate, isOverdue } from '../../utils/format'
import Avatar from '../ui/Avatar'
import { EmptyState, OverdueBadge, PriorityBadge, StatusPill } from '../ui/Display'
import Icon from '../ui/Icon'

interface ListViewProps {
  items: WorkItem[]
  statuses: Status[]
  members: Member[]
  fields: CustomField[]
  onOpen: (item: WorkItem) => void
}

// All items as a table (desktop) or a stack of cards (phones). Every row opens the item.
export default function ListView({ items, statuses, members, fields, onOpen }: ListViewProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white">
        <EmptyState icon="clipboard" title="No tasks here yet" description="Add a task or adjust your filters." />
      </div>
    )
  }

  return (
    <>
      {/* Phones: cards */}
      <div className="stagger space-y-2.5 md:hidden">
        {items.map((item) => {
          const status = statuses.find((s) => s.id === item.statusId)
          const assignee = members.find((m) => m.id === item.assigneeId)
          const overdue = isOverdue(item, statuses)
          return (
            <div
              key={item.id}
              {...pressable(() => onOpen(item), `Open ${item.title}`)}
              className="surface interactive-card group p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 flex-1 text-sm font-semibold text-slate-900 group-hover:text-indigo-700">{item.title}</p>
                <Icon name="chevronRight" className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 group-hover:text-indigo-500" />
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <StatusPill status={status} />
                <PriorityBadge priority={item.priority} />
                {overdue && <OverdueBadge />}
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                {assignee ? (
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Avatar name={assignee.fullName} size="sm" />
                    <span className="truncate">{assignee.fullName}</span>
                  </span>
                ) : (
                  <span className="text-slate-400">Unassigned</span>
                )}
                <span className={cn('inline-flex shrink-0 items-center gap-1', overdue && 'font-semibold text-rose-600')}>
                  <Icon name="calendar" className="h-3.5 w-3.5" />
                  {formatDate(item.dueDate)}
                </span>
              </div>
              {fields.some((f) => item.customValues[f.id]) && (
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  {fields
                    .filter((f) => item.customValues[f.id])
                    .map((field) => (
                      <div key={field.id} className="min-w-0">
                        <dt className="truncate text-slate-400">{field.label}</dt>
                        <dd className="truncate font-medium text-slate-700">{item.customValues[field.id]}</dd>
                      </div>
                    ))}
                </dl>
              )}
            </div>
          )
        })}
      </div>

      {/* Tablet & desktop: table */}
      <div className="surface hidden overflow-hidden md:block animate-fade-in-up">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/80">
              <tr>
                {['Title', 'Status', 'Priority', 'Assignee', 'Due', ...fields.map((f) => f.label)].map((label, i) => (
                  <th
                    key={`${label}-${i}`}
                    scope="col"
                    className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-slate-500 first:pl-5 last:pr-5"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => {
                const status = statuses.find((s) => s.id === item.statusId)
                const assignee = members.find((m) => m.id === item.assigneeId)
                const overdue = isOverdue(item, statuses)
                return (
                  <tr
                    key={item.id}
                    {...pressable(() => onOpen(item), `Open ${item.title}`)}
                    className="group cursor-pointer transition-colors hover:bg-indigo-50/40 focus-visible:bg-indigo-50/40 focus-visible:outline-offset-[-2px]"
                  >
                    <td className="max-w-[22rem] py-3 pr-4 pl-5">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium text-slate-900 transition-colors group-hover:text-indigo-700">
                          {item.title}
                        </span>
                        <Icon
                          name="arrowRight"
                          className="h-3.5 w-3.5 shrink-0 -translate-x-1 text-indigo-500 opacity-0 transition-[opacity,translate] duration-200 group-hover:translate-x-0 group-hover:opacity-100"
                        />
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={status} />
                    </td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={item.priority} />
                    </td>
                    <td className="px-4 py-3">
                      {assignee ? (
                        <span className="inline-flex items-center gap-2 whitespace-nowrap text-slate-700">
                          <Avatar name={assignee.fullName} size="sm" />
                          <span className="text-xs font-medium">{assignee.fullName}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Unassigned</span>
                      )}
                    </td>
                    <td
                      className={cn(
                        'whitespace-nowrap px-4 py-3 text-xs last:pr-5',
                        overdue ? 'font-semibold text-rose-600' : 'text-slate-500',
                      )}
                    >
                      <span className="inline-flex items-center gap-1">
                        {overdue && <Icon name="alert" className="h-3.5 w-3.5" />}
                        {formatDate(item.dueDate)}
                      </span>
                    </td>
                    {fields.map((field) => (
                      <td key={field.id} className="whitespace-nowrap px-4 py-3 text-xs text-slate-600 last:pr-5">
                        {item.customValues[field.id] || '—'}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
