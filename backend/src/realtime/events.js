// Event names sent to the frontend. The frontend reloads work items on `workItems:changed`
// and its project list on `workItems:changed` and `projects:changed` (an employee's projects
// depend on which work items are assigned to them).
export const Events = Object.freeze({
  WORK_ITEMS_CHANGED: 'workItems:changed',
  PROJECTS_CHANGED: 'projects:changed',
  WORKSPACE_CHANGED: 'workspace:changed',
})
