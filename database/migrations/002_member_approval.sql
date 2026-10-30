-- Migration 002: people who sign up themselves wait for a manager's approval.
-- 'pending' members cannot log in or see anything; a manager approves them (-> 'active')
-- or rejects them (the account is deleted). Existing members stay 'active'.
-- Fresh installs get this column from schema.sql already.

ALTER TABLE organization_members
  ADD COLUMN status ENUM('pending', 'active') NOT NULL DEFAULT 'active' AFTER role,
  ADD INDEX idx_org_members_status (organization_id, status);
