import { useDraggable } from '@dnd-kit/core'
import type { Member, Status, WorkItem } from '../../types'
import { cn, formatDate, isOverdue, priorityLabels, priorityStyles } from '../../utils/format'
import Avatar from '../ui/Avatar'

interface WorkItemCardProps {
  item: WorkItem
  statuses: Status[]
  members: Member[]
  onOpen: (item: WorkItem) => void
}

// One card on the board. It can be dragged to another column or clicked to edit.
export default function WorkItemCard({ item, statuses, members, onOpen }: WorkItemCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id })
  const assignee = members.find((m) => m.id === item.assigneeId)
  const overdue = isOverdue(item, statuses)

  // While dragging, move the card with the mouse.
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onOpen(item)}
      className={cn(
        'cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:border-blue-300',
        isDragging && 'z-10 cursor-grabbing opacity-80 shadow-lg',
      )}
    >
      <p className="text-sm font-medium text-slate-900">{item.title}</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className={cn('rounded px-2 py-0.5 text-xs font-medium', priorityStyles[item.priority])}>
          {priorityLabels[item.priority]}
        </span>
        <div className="flex items-center gap-2">
          {item.dueDate && (
            <span className={cn('text-xs', overdue ? 'font-semibold text-red-600' : 'text-slate-500')}>
              {formatDate(item.dueDate)}
            </span>
          )}
          {assignee && <Avatar name={assignee.fullName} size="sm" />}
        </div>
      </div>
    </div>
  )
}
