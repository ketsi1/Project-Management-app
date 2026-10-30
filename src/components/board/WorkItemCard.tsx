import { useDraggable } from '@dnd-kit/core'
import type { Member, Status, WorkItem } from '../../types'
import { cn, formatDate, isOverdue } from '../../utils/format'
import Avatar from '../ui/Avatar'
import { PriorityBadge } from '../ui/Display'
import Icon from '../ui/Icon'

interface WorkItemCardProps {
  item: WorkItem
  statuses: Status[]
  members: Member[]
  onOpen: (item: WorkItem) => void
  draggable?: boolean
}

// One card on the board. Draggable between columns, clickable (or Enter) to open the editor.
export default function WorkItemCard({ item, statuses, members, onOpen, draggable = true }: WorkItemCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id, disabled: !draggable })
  const assignee = members.find((m) => m.id === item.assigneeId)
  const overdue = isOverdue(item, statuses)

  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      aria-label={`Open ${item.title}`}
      onClick={() => onOpen(item)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen(item)
        }
      }}
      className={cn(
        'group relative cursor-pointer touch-manipulation select-none rounded-xl border bg-white p-3.5 shadow-card',
        'transition-[translate,box-shadow,border-color,rotate,scale,opacity] duration-200 ease-out-expo',
        'hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-card-hover',
        overdue ? 'border-rose-200' : 'border-slate-200',
        isDragging && 'z-20 rotate-2 scale-[1.03] cursor-grabbing border-indigo-300 opacity-90 shadow-pop',
      )}
    >
      {/* Title + open hint */}
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-sm font-medium leading-snug text-slate-800 transition-colors group-hover:text-indigo-700">
          {item.title}
        </p>
        <Icon
          name="arrowRight"
          className="mt-0.5 h-3.5 w-3.5 shrink-0 -translate-x-1 text-indigo-500 opacity-0 transition-[opacity,translate] duration-200 group-hover:translate-x-0 group-hover:opacity-100"
        />
      </div>

      {/* Meta row */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <PriorityBadge priority={item.priority} />

        <div className="flex min-w-0 items-center gap-2">
          {item.dueDate && (
            <span
              className={cn(
                'inline-flex items-center gap-1 truncate text-[11px] font-medium',
                overdue ? 'font-semibold text-rose-600' : 'text-slate-400',
              )}
            >
              <Icon name={overdue ? 'alert' : 'calendar'} className="h-3 w-3 shrink-0" />
              {formatDate(item.dueDate)}
            </span>
          )}
          {assignee && <Avatar name={assignee.fullName} size="sm" />}
        </div>
      </div>
    </div>
  )
}
