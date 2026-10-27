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
      <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-6 sm:mx-0 sm:snap-none sm:gap-4 sm:px-0">
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
  const { setNodeRef, isOver } = useDroppable({ id: status.id })

  return (
    <section
      ref={setNodeRef}
      className={cn(
        'flex w-[82vw] max-w-[19rem] shrink-0 snap-start flex-col rounded-2xl border transition-[background-color,border-color,box-shadow] duration-200 sm:w-72 sm:max-w-none',
        isOver ? 'border-indigo-300 bg-indigo-50/70 shadow-[0_0_0_4px_rgb(99_102_241/0.12)]' : 'border-slate-200/70 bg-slate-100/60',
      )}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-3.5 pt-3 pb-2.5">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: status.color, boxShadow: `0 0 0 3px ${status.color}26` }}
        />
        <h2 className="min-w-0 flex-1 truncate text-[13px] font-semibold text-slate-700">{status.name}</h2>
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-semibold tabular-nums text-slate-500 ring-1 ring-slate-200">
          {items.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex min-h-24 flex-col gap-2 px-2.5 pb-2.5">
        {items.map((item) => (
          <WorkItemCard key={item.id} item={item} statuses={statuses} members={members} onOpen={onOpen} />
        ))}
        {items.length === 0 && (
          <div
            className={cn(
              'flex h-20 items-center justify-center rounded-xl border border-dashed text-xs transition-colors',
              isOver ? 'border-indigo-300 bg-indigo-50 text-indigo-500' : 'border-slate-300 text-slate-400',
            )}
          >
            {isOver ? 'Drop here' : 'No tasks'}
          </div>
        )}
      </div>
    </section>
  )
}
