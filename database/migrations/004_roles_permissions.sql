-- Migration 004: User <-> Role <-> Permission authorization.
-- Replaces the fixed ENUM('owner','admin','member') on organization_members with real roles
-- that each organization can edit, and a permission catalog the roles are linked to.
-- Existing members keep their role: every organization gets owner/admin/manager/member roles
-- and each membership is pointed at the role with the same name.
-- Permissions and each role's permissions are filled in by `npm run db:migrate` right after
-- this file runs (from backend/src/auth/permissions.js). Fresh installs get these tables from schema.sql.

CREATE TABLE IF NOT EXISTS permissions (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  `key` VARCHAR(100) NOT NULL,
  name VARCHAR(150) NOT NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  group_name VARCHAR(50) NOT NULL DEFAULT 'General',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_permissions_key (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS roles (
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

CREATE TABLE IF NOT EXISTS role_permissions (
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

-- Default roles for every existing organization.
INSERT IGNORE INTO roles (id, organization_id, slug, name, description, is_system)
SELECT UUID(), o.id, d.slug, d.name, d.description, d.is_system
  FROM organizations o
 CROSS JOIN (
   SELECT 'owner' AS slug, 'Owner' AS name, 'Full control of the organization. There is one owner and they cannot be removed.' AS description, TRUE AS is_system
   UNION ALL SELECT 'admin', 'Admin', 'Runs the workspace: people, roles, settings, projects and all tasks.', TRUE
   UNION ALL SELECT 'manager', 'Project Manager', 'Plans projects and manages everyone’s tasks, but not people or settings.', FALSE
   UNION ALL SELECT 'member', 'Member', 'Works on the tasks assigned to them and can add their own.', TRUE
 ) d;

-- Point each membership at its role, then drop the old ENUM column.
ALTER TABLE organization_members ADD COLUMN role_id CHAR(36) NULL AFTER user_id;

UPDATE organization_members m
  JOIN roles r ON r.organization_id = m.organization_id AND r.slug = m.role
   SET m.role_id = r.id;

ALTER TABLE organization_members
  MODIFY role_id CHAR(36) NOT NULL,
  DROP COLUMN role,
  ADD INDEX idx_org_members_role (role_id),
  ADD CONSTRAINT fk_org_members_role
    FOREIGN KEY (role_id) REFERENCES roles (id)
    ON DELETE RESTRICT ON UPDATE CASCADE;
