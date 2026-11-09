// Event names sent to the frontend. The frontend reloads work items on `workItems:changed`
// and its project list on `workItems:changed` and `projects:changed` (an employee's projects
// depend on which work items are assigned to them).
export const Events = Object.freeze({
  WORK_ITEMS_CHANGED: 'workItems:changed',
  PROJECTS_CHANGED: 'projects:changed',
  WORKSPACE_CHANGED: 'workspace:changed',
  // A bug was reported, changed, commented on or deleted. The frontend reloads its bug list.
  BUGS_CHANGED: 'bugs:changed',
} as const)

// 'workItems:changed' | 'projects:changed' | 'workspace:changed' | 'bugs:changed'
export type EventName = (typeof Events)[keyof typeof Events]

// Payloads are small hints (what changed, its id); the frontend reloads over HTTP.
export type EventPayload = Record<string, string | number | boolean | null | undefined>
