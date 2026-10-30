-- Migration 001: revocable login sessions for the Express backend.
-- Safe to run on a database created from the original schema.sql: it only adds a table.
-- Fresh installs get this table from schema.sql already.

CREATE TABLE IF NOT EXISTS auth_sessions (
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
