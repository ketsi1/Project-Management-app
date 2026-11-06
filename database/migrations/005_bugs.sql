-- Migration 005: bug tracking.
-- A bug belongs to a project, has a per-organization number (shown as BUG-12), a severity,
-- a status (open -> in_progress -> resolved -> closed) and, once resolved or closed, a resolution.
-- bug_comments holds the discussion and an automatic activity log (kind = 'event').
-- Fresh installs get these tables from schema.sql already. The new bug permissions are added
-- to the default roles by `npm run db:migrate` right after this file runs.

CREATE TABLE IF NOT EXISTS bugs (
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

CREATE TABLE IF NOT EXISTS bug_comments (
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
