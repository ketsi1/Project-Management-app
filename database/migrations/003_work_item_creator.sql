-- Migration 003: remember who created each work item.
-- Employees may only edit or delete work items they created themselves; on work items
-- a manager created they can only change the status (when the item is assigned to them).
-- Existing items get their organization's owner as creator, so employees cannot delete them.
-- Fresh installs get this column from schema.sql already.

ALTER TABLE work_items
  ADD COLUMN created_by CHAR(36) NULL AFTER custom_values,
  ADD INDEX idx_work_items_created_by (created_by),
  ADD CONSTRAINT fk_work_items_created_by
    FOREIGN KEY (created_by) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE work_items w
  JOIN organization_members m ON m.organization_id = w.organization_id AND m.role = 'owner'
   SET w.created_by = m.user_id
 WHERE w.created_by IS NULL;
