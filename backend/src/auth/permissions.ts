// The single list of permissions the app checks, and the roles every organization starts with.
// The seeders copy this into the `permissions`, `roles` and `role_permissions` tables, and the
// routes check these keys with requirePermission(). Add a permission here, then run
// `npm run seed:permissions` so it exists in the database.

export interface PermissionDefinition {
  readonly key: string
  readonly group: string
  readonly name: string
  readonly description: string
}

export const PERMISSIONS = Object.freeze([
  // Organization settings
  { key: 'organization.update', group: 'Organization', name: 'Edit organization', description: 'Change the organization name and terminology.' },
  { key: 'statuses.manage', group: 'Organization', name: 'Manage statuses', description: 'Add, rename, reorder and delete board columns.' },
  { key: 'fields.manage', group: 'Organization', name: 'Manage custom fields', description: 'Add and delete custom fields on tasks.' },

  // People
  { key: 'members.view', group: 'Members', name: 'View team', description: 'See the team page with everyone’s workload.' },
  { key: 'members.create', group: 'Members', name: 'Add members', description: 'Create accounts and send invitations.' },
  { key: 'members.approve', group: 'Members', name: 'Approve sign-ups', description: 'Approve or reject people who signed up themselves.' },
  { key: 'members.update_role', group: 'Members', name: 'Change member roles', description: 'Give a member a different role.' },
  { key: 'members.remove', group: 'Members', name: 'Remove members', description: 'Remove people from the organization.' },
  { key: 'roles.manage', group: 'Members', name: 'Manage roles', description: 'Create, edit and delete roles and their permissions.' },

  // Projects
  { key: 'projects.view_all', group: 'Projects', name: 'See all projects', description: 'Without this, a person only sees projects that have work assigned to them.' },
  { key: 'projects.create', group: 'Projects', name: 'Create projects', description: 'Start new projects.' },
  { key: 'projects.update', group: 'Projects', name: 'Edit projects', description: 'Rename projects and change their description.' },
  { key: 'projects.delete', group: 'Projects', name: 'Delete projects', description: 'Delete projects and all their tasks.' },

  // Tasks
  { key: 'tasks.view_all', group: 'Tasks', name: 'See all tasks', description: 'See everyone’s tasks and the team dashboard, not just your own.' },
  { key: 'tasks.create', group: 'Tasks', name: 'Create tasks', description: 'Add tasks to projects they can see.' },
  { key: 'tasks.manage_all', group: 'Tasks', name: 'Edit any task', description: 'Edit and delete any task. Without this, people edit only tasks they created and change the status of tasks assigned to them.' },

  // Bugs
  { key: 'bugs.report', group: 'Bugs', name: 'Report bugs', description: 'Report new bugs. Anyone who can see a bug can comment on it.' },
  { key: 'bugs.view_all', group: 'Bugs', name: 'See all bugs', description: 'See every bug. Without this, people see bugs they reported, bugs assigned to them and bugs in projects they can see.' },
  { key: 'bugs.manage', group: 'Bugs', name: 'Triage bugs', description: 'Assign, prioritize, edit, resolve and delete any bug. Without this, reporters edit their own bugs and assignees update the status.' },
] as const satisfies readonly PermissionDefinition[])

// 'organization.update' | 'statuses.manage' | ... — a typo in a permission name is a compile error.
export type PermissionKey = (typeof PERMISSIONS)[number]['key']

export const PERMISSION_KEYS: readonly PermissionKey[] = Object.freeze(PERMISSIONS.map((p) => p.key))

export const isPermissionKey = (key: string): key is PermissionKey => (PERMISSION_KEYS as readonly string[]).includes(key)

export interface DefaultRole {
  readonly slug: string
  readonly name: string
  readonly description: string
  readonly system: boolean
  readonly permissions: readonly PermissionKey[]
}

// Roles every organization gets. `system` roles cannot be deleted or renamed.
// The owner always has every permission and cannot be edited.
export const DEFAULT_ROLES = Object.freeze([
  {
    slug: 'owner',
    name: 'Owner',
    description: 'Full control of the organization. There is one owner and they cannot be removed.',
    system: true,
    permissions: PERMISSION_KEYS,
  },
  {
    slug: 'admin',
    name: 'Admin',
    description: 'Runs the workspace: people, roles, settings, projects and all tasks.',
    system: true,
    permissions: PERMISSION_KEYS,
  },
  {
    slug: 'manager',
    name: 'Project Manager',
    description: 'Plans projects and manages everyone’s tasks, but not people or settings.',
    system: false,
    permissions: [
      'members.view',
      'projects.view_all',
      'projects.create',
      'projects.update',
      'tasks.view_all',
      'tasks.create',
      'tasks.manage_all',
      'bugs.report',
      'bugs.view_all',
      'bugs.manage',
    ],
  },
  {
    slug: 'member',
    name: 'Member',
    description: 'Works on the tasks assigned to them and can add their own.',
    system: true,
    permissions: ['tasks.create', 'bugs.report'],
  },
] as const satisfies readonly DefaultRole[])

// 'owner' | 'admin' | 'manager' | 'member'
export type DefaultRoleSlug = (typeof DEFAULT_ROLES)[number]['slug']

export const OWNER_SLUG = 'owner' satisfies DefaultRoleSlug
// The role people get when they sign up themselves.
export const DEFAULT_MEMBER_SLUG = 'member' satisfies DefaultRoleSlug

// Permissions that make someone a "manager" in the UI (team dashboard instead of personal one).
export const MANAGER_VIEW_PERMISSION: PermissionKey = 'tasks.view_all'
