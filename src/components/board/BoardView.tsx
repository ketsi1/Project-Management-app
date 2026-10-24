import { DndContext, PointerSensor, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import type { Member, Status, WorkItem } from '../../types'
import { cn } from '../../utils/format'
import WorkItemCard from './WorkItemCard'

interface BoardViewProps {
  statuses: Status[]
  items: WorkItem[]
  members: Member[]
  onMove: (itemId: string, statusId: string) => void
  onOpen: (item: WorkItem) => void
}

// The Kanban board: one column per status, cards can be dragged between columns.
export default function BoardView({ statuses, items, members, onMove, onOpen }: BoardViewProps) {
  // Start a drag only after the pointer moves 5px, so a simple click still opens the card.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function handleDragEnd(event: DragEndEvent) {
    const itemId = String(event.active.id)
    const statusId = event.over ? String(event.over.id) : null
    const item = items.find((i) => i.id === itemId)
    if (item && statusId && item.statusId !== statusId) onMove(itemId, statusId)
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {statuses.map((status) => (
          <BoardColumn
            key={status.id}
            status={status}
            items={items.filter((item) => item.statusId === status.id)}
            statuses={statuses}
            members={members}
            onOpen={onOpen}
          />
        ))}
      </div>
    </DndContext>
  )
}

interface BoardColumnProps {
  status: Status
  items: WorkItem[]
  statuses: Status[]
  members: Member[]
  onOpen: (item: WorkItem) => void
}

function BoardColumn({ status, items, statuses, members, onOpen }: BoardColumnProps) {
  // The column's id is the status id, so a drop tells us the new status.
  const { setNodeRef, isOver } = useDroppable({ id: status.id })

  return (
    <section
      ref={setNodeRef}
      className={cn(
        'flex w-72 shrink-0 flex-col rounded-xl bg-slate-100 p-3 transition-colors',
        isOver && 'bg-blue-50 ring-2 ring-blue-300',
      )}
    >
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: status.color }} />
        {status.name}
        <span className="ml-auto font-normal text-slate-500">{items.length}</span>
      </h2>
      <div className="flex min-h-24 flex-col gap-2">
        {items.map((item) => (
          <WorkItemCard key={item.id} item={item} statuses={statuses} members={members} onOpen={onOpen} />
        ))}
      </div>
    </section>
  )
}
