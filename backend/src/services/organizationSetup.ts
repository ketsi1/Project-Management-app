// The starter content every new organization gets (same as mockApi.ts seedOrganization).
import { prisma, type Db } from '../db/prisma.ts'
import type { Priority, StatusCategory } from '../generated/prisma/client.ts'
import { daysFromToday, newId } from '../utils/time.ts'

const DEFAULT_STATUSES: { name: string; category: StatusCategory; color: string }[] = [
  { name: 'To do', category: 'not_started', color: '#94a3b8' },
  { name: 'In progress', category: 'active', color: '#3b82f6' },
  { name: 'In review', category: 'active', color: '#f59e0b' },
  { name: 'Done', category: 'done', color: '#22c55e' },
]

// `status` is an index into DEFAULT_STATUSES; `days` is the due date relative to today.
const SAMPLE_ITEMS: { title: string; status: number; priority: Priority; days: number }[] = [
  { title: 'Invite your team members', status: 0, priority: 'high', days: 2 },
  { title: 'Rename statuses to match your process', status: 1, priority: 'medium', days: 4 },
  { title: 'Add a custom field in Settings', status: 2, priority: 'low', days: 7 },
  { title: 'Create your account', status: 3, priority: 'low', days: -1 },
]

// `db` can be a transaction client.
export async function createStarterContent(
  db: Db = prisma,
  { organizationId, ownerId }: { organizationId: string; ownerId: string },
): Promise<void> {
  const statusIds = DEFAULT_STATUSES.map(() => newId())
  await db.status.createMany({
    data: DEFAULT_STATUSES.map((status, position) => ({ id: statusIds[position]!, organizationId, position, ...status })),
  })

  const projectId = newId()
  await db.project.create({
    data: { id: projectId, organizationId, name: 'Getting started', description: 'A sample project to explore the board.' },
  })

  await db.workItem.createMany({
    data: SAMPLE_ITEMS.map((item) => ({
      id: newId(),
      organizationId,
      projectId,
      title: item.title,
      description: '',
      statusId: statusIds[item.status]!,
      priority: item.priority,
      assigneeId: ownerId,
      dueDate: daysFromToday(item.days),
      customValues: {},
      createdById: ownerId,
    })),
  })
}
