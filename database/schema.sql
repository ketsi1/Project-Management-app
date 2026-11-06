-- =============================================================================
-- MySQL Database Schema for PM Tool
-- Compatible with MySQL 8.0+ / 8.4 LTS
-- Character Set: utf8mb4 (Supports international characters and emojis)
-- =============================================================================

CREATE DATABASE IF NOT EXISTS pm_database
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE pm_database;

-- Disable foreign key checks during setup
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- 1. Table: organizations
-- Root entity for multi-tenancy. Stores the organization name and configurable
-- terminology (e.g. "Project"/"Activity" or "Task"/"Subtask").
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS organizations;
CREATE TABLE organizations (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  name VARCHAR(255) NOT NULL,
  
  -- Configurable Terminology (default: Project / Projects, Task / Tasks)
  term_project VARCHAR(50) NOT NULL DEFAULT 'Project',
  term_projects VARCHAR(50) NOT NULL DEFAULT 'Projects',
  term_task VARCHAR(50) NOT NULL DEFAULT 'Task',
  term_tasks VARCHAR(50) NOT NULL DEFAULT 'Tasks',
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -----------------------------------------------------------------------------
-- 2. Table: users
-- Stores registered accounts and invited team members.
-- Note: password_hash is NULL for invited members who have not activated their account.
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS users;
CREATE TABLE users (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NULL,
  
  -- Optional invitation token for activation flow
  invitation_token VARCHAR(128) NULL,
  invitation_expires_at TIMESTAMP NULL,
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  INDEX idx_users_invitation (invitation_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -----------------------------------------------------------------------------
-- 3a. Table: permissions
-- The catalog of things a role can be allowed to do (e.g. 'projects.create').
-- Filled from backend/src/auth/permissions.js by `npm run seed:permissions`.
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS permissions;
CREATE TABLE permissions (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  `key` VARCHAR(100) NOT NULL,
  name VARCHAR(150) NOT NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  group_name VARCHAR(50) NOT NULL DEFAULT 'General',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_permissions_key (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -----------------------------------------------------------------------------
-- 3b. Table: roles
-- Roles belong to an organization. Every organization gets owner/admin/manager/member
-- (`npm run seed:roles`); admins can add their own. System roles cannot be deleted.
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS roles;
CREATE TABLE roles (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  organization_id CHAR(36) NOT NULL,
  slug VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  is_system BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_org_slug (organization_id, slug),

  CONSTRAINT fk_roles_organization
    FOREIGN KEY (organization_id) REFERENCES organizations (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -----------------------------------------------------------------------------
-- 3c. Table: role_permissions
-- Which permissions each role has.
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS role_permissions;
CREATE TABLE role_permissions (
  role_id CHAR(36) NOT NULL,
  permission_id CHAR(36) NOT NULL,

  PRIMARY KEY (role_id, permission_id),
  INDEX idx_role_permissions_permission (permission_id),

  CONSTRAINT fk_role_permissions_role
    FOREIGN KEY (role_id) REFERENCES roles (id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_role_permissions_permission
    FOREIGN KEY (permission_id) REFERENCES permissions (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -----------------------------------------------------------------------------
-- 3d. Table: organization_members
-- A user's membership in an organization and the role they have there.
-- status: 'pending' = signed up and waiting for approval (cannot log in);
--         'active'  = approved, invited or created by an admin.
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS organization_members;
CREATE TABLE organization_members (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  organization_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  role_id CHAR(36) NOT NULL,
  status ENUM('pending', 'active') NOT NULL DEFAULT 'active',

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_org_user (organization_id, user_id),
  INDEX idx_org_members_user (user_id),
  INDEX idx_org_members_org (organization_id),
  INDEX idx_org_members_status (organization_id, status),
  INDEX idx_org_members_role (role_id),

  CONSTRAINT fk_org_members_organization
    FOREIGN KEY (organization_id) REFERENCES organizations (id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_org_members_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_org_members_role
    FOREIGN KEY (role_id) REFERENCES roles (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -----------------------------------------------------------------------------
-- 4. Table: statuses
-- Board columns configured per organization.
-- Maps to categories: 'not_started', 'active', 'done', 'cancelled'.
-- Ordered by 'position' ascending.
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS statuses;
CREATE TABLE statuses (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  organization_id CHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  category ENUM('not_started', 'active', 'done', 'cancelled') NOT NULL,
  color VARCHAR(16) NOT NULL DEFAULT '#6366f1',
  position INT UNSIGNED NOT NULL DEFAULT 0,
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (id),
  INDEX idx_statuses_org_position (organization_id, position),
  
  CONSTRAINT fk_statuses_organization
    FOREIGN KEY (organization_id) REFERENCES organizations (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -----------------------------------------------------------------------------
-- 5. Table: custom_fields
-- Dynamic fields defined per organization (e.g. "Budget", "Donor").
-- Types: 'text', 'number', 'date', 'select'.
-- 'options' stores a JSON array of strings for dropdown fields (e.g. ["USAID", "UNICEF"]).
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS custom_fields;
CREATE TABLE custom_fields (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  organization_id CHAR(36) NOT NULL,
  label VARCHAR(100) NOT NULL,
  type ENUM('text', 'number', 'date', 'select') NOT NULL,
  options JSON NULL,
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (id),
  INDEX idx_custom_fields_org (organization_id),
  
  CONSTRAINT fk_custom_fields_organization
    FOREIGN KEY (organization_id) REFERENCES organizations (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -----------------------------------------------------------------------------
-- 6. Table: projects
-- Projects created within an organization.
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS projects;
CREATE TABLE projects (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  organization_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (id),
  INDEX idx_projects_org (organization_id, created_at),
  
  CONSTRAINT fk_projects_organization
    FOREIGN KEY (organization_id) REFERENCES organizations (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -----------------------------------------------------------------------------
-- 7. Table: work_items
-- The core work item / task.
-- - status_id: ON DELETE RESTRICT (Frontend mandates reassigning tasks to another
--   status before deleting a status column).
-- - assignee_id: ON DELETE SET NULL (Removing a user unassigns their tasks).
-- - custom_values: JSON column containing key-value pairs matching custom field IDs:
--   e.g. {"field-uuid-1": "10000", "field-uuid-2": "USAID"}.
-- - created_by: who created the item (ON DELETE SET NULL). Employees may only edit or
--   delete items they created; on other items they can only change the status.
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS work_items;
CREATE TABLE work_items (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  organization_id CHAR(36) NOT NULL,
  project_id CHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  status_id CHAR(36) NOT NULL,
  priority ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
  assignee_id CHAR(36) NULL,
  due_date DATE NULL,
  custom_values JSON NULL,
  created_by CHAR(36) NULL,
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (id),
  INDEX idx_work_items_project (project_id),
  INDEX idx_work_items_status (status_id),
  INDEX idx_work_items_assignee (assignee_id),
  INDEX idx_work_items_org_due (organization_id, due_date),
  INDEX idx_work_items_created_by (created_by),
  
  CONSTRAINT fk_work_items_organization
    FOREIGN KEY (organization_id) REFERENCES organizations (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
    
  CONSTRAINT fk_work_items_project
    FOREIGN KEY (project_id) REFERENCES projects (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
    
  CONSTRAINT fk_work_items_status
    FOREIGN KEY (status_id) REFERENCES statuses (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
    
  CONSTRAINT fk_work_items_assignee
    FOREIGN KEY (assignee_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE,

  CONSTRAINT fk_work_items_created_by
    FOREIGN KEY (created_by) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -----------------------------------------------------------------------------
-- 8. Table: auth_sessions
-- One row per issued login token (the token's JWT "jti" is this row's id).
-- The backend accepts a token only while its row exists, is not revoked and has
-- not expired, so logout and member removal take effect immediately.
-- Deleting a user or organization deletes their sessions.
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS auth_sessions;
CREATE TABLE auth_sessions (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  user_agent VARCHAR(255) NULL,
  ip_address VARCHAR(45) NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL,

  PRIMARY KEY (id),
  INDEX idx_auth_sessions_user (user_id),
  INDEX idx_auth_sessions_expires (expires_at),

  CONSTRAINT fk_auth_sessions_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_auth_sessions_organization
    FOREIGN KEY (organization_id) REFERENCES organizations (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 9. Tables: bugs, bug_comments
-- Bug tracking. A bug belongs to a project and has a per-organization number (BUG-12).
-- status: open -> in_progress -> resolved -> closed; resolution is set once resolved/closed.
-- bug_comments holds the discussion plus an automatic activity log (kind = 'event').
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS bugs;
CREATE TABLE bugs (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  organization_id CHAR(36) NOT NULL,
  project_id CHAR(36) NOT NULL,
  work_item_id CHAR(36) NULL,
  number INT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  steps_to_reproduce TEXT NULL,
  expected_result TEXT NULL,
  actual_result TEXT NULL,
  environment VARCHAR(255) NOT NULL DEFAULT '',
  severity ENUM('critical', 'major', 'minor', 'trivial') NOT NULL DEFAULT 'major',
  priority ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
  status ENUM('open', 'in_progress', 'resolved', 'closed') NOT NULL DEFAULT 'open',
  resolution ENUM('fixed', 'wont_fix', 'duplicate', 'cannot_reproduce', 'by_design') NULL,
  reporter_id CHAR(36) NULL,
  assignee_id CHAR(36) NULL,
  resolved_at TIMESTAMP NULL,
  closed_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_bugs_org_number (organization_id, number),
  INDEX idx_bugs_org_status (organization_id, status),
  INDEX idx_bugs_project (project_id),
  INDEX idx_bugs_assignee (assignee_id),
  INDEX idx_bugs_reporter (reporter_id),
  INDEX idx_bugs_work_item (work_item_id),
  CONSTRAINT fk_bugs_organization FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_bugs_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_bugs_work_item FOREIGN KEY (work_item_id) REFERENCES work_items (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_bugs_reporter FOREIGN KEY (reporter_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_bugs_assignee FOREIGN KEY (assignee_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS bug_comments;
CREATE TABLE bug_comments (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  -- Keeps the activity log in order when several entries share the same second.
  seq BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id CHAR(36) NOT NULL,
  bug_id CHAR(36) NOT NULL,
  author_id CHAR(36) NULL,
  kind ENUM('comment', 'event') NOT NULL DEFAULT 'comment',
  body TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_bug_comments_seq (seq),
  INDEX idx_bug_comments_bug (bug_id, seq),
  CONSTRAINT fk_bug_comments_organization FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_bug_comments_bug FOREIGN KEY (bug_id) REFERENCES bugs (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_bug_comments_author FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;
