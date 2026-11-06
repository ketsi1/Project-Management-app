-- =============================================================================
-- MySQL Starter / Seed Data Script
-- Populates multi-role seed data: Boss/Manager View and Employee View
-- Compatible with MySQL 8.0+ / 8.4 LTS
-- Matches the demo data in pm-frontend/src/api/mockApi.ts.
-- Safe to run more than once: every row has a fixed id and is upserted.
-- =============================================================================

USE pm_database;

-- Match the tables' collation so @variables and text values compare cleanly with columns.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Define fixed UUIDs for deterministic seed data
SET @org_id = '11111111-1111-1111-1111-111111111111';

-- Users
SET @user_alex = '22222222-2222-2222-2222-222222222222';   -- Alex Morgan (Owner / PM)
SET @user_sarah = '33333333-3333-3333-3333-333333333333';  -- Sarah Connor (Employee / Dev)
SET @user_david = '44444444-4444-4444-4444-444444444444';  -- David Kim (Employee / Dev)

-- bcrypt (cost 10) hashes. Each user has their own password (see database/README.md):
--   alex@acme.com  -> 87654321   (manager view)
--   sarah@acme.com -> 12345678     (employee view)
--   david@acme.com -> 21345678     (employee view)
SET @pw_alex = '$2b$10$Mh8tEkMqRUgVNfqqNGNQXOsQeqES3DHVe4mgj.rmrNcwqtr84ZL/.';
SET @pw_sarah = '$2b$10$ThS6NBJj60V3IXoEHCLg6eiR5wT2wcjeqg9KKvhZkZQfxQkZtoxLu';
SET @pw_david = '$2b$10$jCERyCFbg/RT.caB47qIsO4ayeysGze7HCxNEmZabVWhRCUxu8Pey';

-- Statuses
SET @status_todo = '33333333-3333-3333-3333-333333333301';
SET @status_in_progress = '33333333-3333-3333-3333-333333333302';
SET @status_in_review = '33333333-3333-3333-3333-333333333303';
SET @status_done = '33333333-3333-3333-3333-333333333304';

-- Custom fields
SET @field_department = '66666666-6666-6666-6666-666666666661';
SET @field_est_hours = '66666666-6666-6666-6666-666666666662';

-- Projects
SET @proj_web = '55555555-5555-5555-5555-555555555551';
SET @proj_app = '55555555-5555-5555-5555-555555555552';

-- 1. Create Organization with default terminology
INSERT INTO organizations (id, name, term_project, term_projects, term_task, term_tasks)
VALUES (@org_id, 'Acme Corp', 'Project', 'Projects', 'Task', 'Tasks')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 2. Create Users (1 manager, 2 developers)
INSERT INTO users (id, full_name, email, password_hash)
VALUES
  (@user_alex, 'Alex Morgan', 'alex@acme.com', @pw_alex),
  (@user_sarah, 'Sarah Connor', 'sarah@acme.com', @pw_sarah),
  (@user_david, 'David Kim', 'david@acme.com', @pw_david)
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), password_hash = VALUES(password_hash);

-- 3. Roles, then link Users to the Organization with a Role.
-- The role rows are created here so memberships can point at them; their permissions are
-- filled in by `npm run db:seed` / `npm run seed:roles` (from backend/src/auth/permissions.js).
INSERT IGNORE INTO roles (id, organization_id, slug, name, description, is_system)
VALUES
  (UUID(), @org_id, 'owner', 'Owner', 'Full control of the organization. There is one owner and they cannot be removed.', TRUE),
  (UUID(), @org_id, 'admin', 'Admin', 'Runs the workspace: people, roles, settings, projects and all tasks.', TRUE),
  (UUID(), @org_id, 'manager', 'Project Manager', 'Plans projects and manages everyone’s tasks, but not people or settings.', FALSE),
  (UUID(), @org_id, 'member', 'Member', 'Works on the tasks assigned to them and can add their own.', TRUE);

SET @role_owner = (SELECT id FROM roles WHERE organization_id = @org_id AND slug = 'owner');
SET @role_member = (SELECT id FROM roles WHERE organization_id = @org_id AND slug = 'member');

INSERT INTO organization_members (id, organization_id, user_id, role_id, status)
VALUES
  ('77777777-7777-7777-7777-777777777771', @org_id, @user_alex, @role_owner, 'active'),
  ('77777777-7777-7777-7777-777777777772', @org_id, @user_sarah, @role_member, 'active'),
  ('77777777-7777-7777-7777-777777777773', @org_id, @user_david, @role_member, 'active')
ON DUPLICATE KEY UPDATE role_id = VALUES(role_id), status = VALUES(status);

-- 4. Create Default Statuses (Board Columns)
INSERT INTO statuses (id, organization_id, name, category, color, position)
VALUES
  (@status_todo, @org_id, 'To do', 'not_started', '#94a3b8', 0),
  (@status_in_progress, @org_id, 'In progress', 'active', '#3b82f6', 1),
  (@status_in_review, @org_id, 'In review', 'active', '#f59e0b', 2),
  (@status_done, @org_id, 'Done', 'done', '#22c55e', 3)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 5. Create Custom Fields
INSERT INTO custom_fields (id, organization_id, label, type, options)
VALUES
  (@field_department, @org_id, 'Department', 'select', JSON_ARRAY('Engineering', 'Design', 'Management', 'QA')),
  (@field_est_hours, @org_id, 'Est. Hours', 'number', JSON_ARRAY())
ON DUPLICATE KEY UPDATE label = VALUES(label);

-- 6. Create Sample Projects
INSERT INTO projects (id, organization_id, name, description)
VALUES
  (
    @proj_web,
    @org_id,
    'Website Redesign & Launch',
    'Modernize marketing site, design new dashboard experience and deploy to production.'
  ),
  (
    @proj_app,
    @org_id,
    'Mobile App MVP',
    'Native iOS and Android client for on-the-go project tracking and real-time alerts.'
  )
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 7. Create Sample Work Items (Tasks for Boss & Employees)
-- custom_values keys are the custom field ids above. Alex (the manager) created every sample task,
-- so employees can change their status but cannot edit or delete them.
INSERT INTO work_items (id, organization_id, project_id, title, description, status_id, priority, assignee_id, due_date, custom_values, created_by)
VALUES
  -- Project 1 Tasks
  (
    '88888888-8888-8888-8888-888888888801', @org_id, @proj_web,
    'Design responsive mockups & component tokens',
    'Create high-fidelity Figma screens for both desktop and mobile breakpoints.',
    @status_in_progress, 'high', @user_david, DATE_ADD(CURRENT_DATE(), INTERVAL 3 DAY),
    JSON_OBJECT(@field_department, 'Design', @field_est_hours, '16'),
    @user_alex
  ),
  (
    '88888888-8888-8888-8888-888888888802', @org_id, @proj_web,
    'Build interactive Employee Workstation view',
    'Implement personal task queue, daily focus mode, and 1-click status transitions.',
    @status_in_progress, 'urgent', @user_sarah, DATE_ADD(CURRENT_DATE(), INTERVAL 2 DAY),
    JSON_OBJECT(@field_department, 'Engineering', @field_est_hours, '20'),
    @user_alex
  ),
  (
    '88888888-8888-8888-8888-888888888803', @org_id, @proj_web,
    'Executive Manager Command Center & Team Matrix',
    'Provide portfolio health metrics, team capacity distribution, and project controls.',
    @status_done, 'high', @user_sarah, DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY),
    JSON_OBJECT(@field_department, 'Engineering', @field_est_hours, '18'),
    @user_alex
  ),
  (
    '88888888-8888-8888-8888-888888888804', @org_id, @proj_web,
    'Review project milestones & budget with stakeholders',
    'Executive quarterly sync to approve budget allocation and Q4 roadmap.',
    @status_in_review, 'high', @user_alex, DATE_ADD(CURRENT_DATE(), INTERVAL 5 DAY),
    JSON_OBJECT(@field_department, 'Management', @field_est_hours, '6'),
    @user_alex
  ),
  (
    '88888888-8888-8888-8888-888888888805', @org_id, @proj_web,
    'Set up automated CI/CD deployment pipeline',
    'Configure GitHub Actions test suite and automated staging deploy.',
    @status_todo, 'medium', @user_sarah, DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY),
    JSON_OBJECT(@field_department, 'Engineering', @field_est_hours, '12'),
    @user_alex
  ),

  -- Project 2 Tasks
  (
    '88888888-8888-8888-8888-888888888806', @org_id, @proj_app,
    'Mobile app user onboarding wireframes & flows',
    'Design step-by-step account activation and workspace creation flow for phone screens.',
    @status_done, 'high', @user_david, DATE_SUB(CURRENT_DATE(), INTERVAL 2 DAY),
    JSON_OBJECT(@field_department, 'Design', @field_est_hours, '14'),
    @user_alex
  ),
  (
    '88888888-8888-8888-8888-888888888807', @org_id, @proj_app,
    'Implement push notification service integration',
    'Send instant notifications when task status changes or when a user is assigned work.',
    @status_todo, 'medium', @user_sarah, DATE_ADD(CURRENT_DATE(), INTERVAL 4 DAY),
    JSON_OBJECT(@field_department, 'Engineering', @field_est_hours, '15'),
    @user_alex
  ),
  (
    '88888888-8888-8888-8888-888888888808', @org_id, @proj_app,
    'Team sprint capacity allocation & project plan',
    'Align cross-functional team bandwidth for mobile MVP release.',
    @status_in_progress, 'high', @user_alex, DATE_ADD(CURRENT_DATE(), INTERVAL 1 DAY),
    JSON_OBJECT(@field_department, 'Management', @field_est_hours, '8'),
    @user_alex
  ),
  (
    '88888888-8888-8888-8888-888888888809', @org_id, @proj_app,
    'Design dark mode palette and icon set',
    'Ensure contrast compliance for WCAG AAA and export SVG icon assets.',
    @status_in_review, 'low', @user_david, DATE_ADD(CURRENT_DATE(), INTERVAL 6 DAY),
    JSON_OBJECT(@field_department, 'Design', @field_est_hours, '10'),
    @user_alex
  ),
  (
    '88888888-8888-8888-8888-888888888810', @org_id, @proj_app,
    'Conduct sprint retrospective & team feedback',
    'Collect feedback on velocity and process improvements.',
    @status_todo, 'low', @user_alex, DATE_ADD(CURRENT_DATE(), INTERVAL 8 DAY),
    JSON_OBJECT(@field_department, 'Management', @field_est_hours, '4'),
    @user_alex
  )
ON DUPLICATE KEY UPDATE title = VALUES(title), created_by = VALUES(created_by);

-- 9. Sample bugs (bug tracking). Each is added once; numbers continue after any existing bugs.
SET @n = (SELECT COALESCE(MAX(number), 0) + 1 FROM bugs WHERE organization_id = @org_id);
INSERT INTO bugs (id, organization_id, project_id, work_item_id, number, title, description, steps_to_reproduce, expected_result, actual_result, environment, severity, priority, status, reporter_id, assignee_id)
SELECT '99999999-9999-9999-9999-999999999901', @org_id, @proj_web, NULL, @n,
  'Checkout button does nothing on Safari',
  'Customers on Safari cannot finish an order.',
  '1. Open the site in Safari 17\n2. Add any product to the cart\n3. Click "Checkout"',
  'The checkout page opens.',
  'Nothing happens. The console shows "TypeError: undefined is not an object".',
  'Safari 17 / macOS 14', 'critical', 'urgent', 'in_progress', @user_sarah, @user_david
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM bugs WHERE id = '99999999-9999-9999-9999-999999999901');

SET @n = (SELECT COALESCE(MAX(number), 0) + 1 FROM bugs WHERE organization_id = @org_id);
INSERT INTO bugs (id, organization_id, project_id, work_item_id, number, title, description, steps_to_reproduce, expected_result, actual_result, environment, severity, priority, status, reporter_id, assignee_id)
SELECT '99999999-9999-9999-9999-999999999902', @org_id, @proj_web, NULL, @n,
  'Footer links overlap on small phones',
  '',
  '1. Open the home page on a 320px wide screen\n2. Scroll to the footer',
  'Links wrap onto separate lines.',
  'Links overlap and cannot be tapped.',
  'iPhone SE, Chrome', 'minor', 'low', 'open', @user_david, NULL
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM bugs WHERE id = '99999999-9999-9999-9999-999999999902');

SET @n = (SELECT COALESCE(MAX(number), 0) + 1 FROM bugs WHERE organization_id = @org_id);
INSERT INTO bugs (id, organization_id, project_id, work_item_id, number, title, description, steps_to_reproduce, expected_result, actual_result, environment, severity, priority, status, resolution, reporter_id, assignee_id, resolved_at)
SELECT '99999999-9999-9999-9999-999999999903', @org_id, @proj_app, NULL, @n,
  'App crashes when uploading a profile photo',
  'Happens with photos larger than 10 MB.',
  '1. Open Profile\n2. Tap "Change photo"\n3. Choose a photo over 10 MB',
  'The photo is resized and saved.',
  'The app closes.',
  'Android 14, app v0.3.1', 'major', 'high', 'resolved', 'fixed', @user_alex, @user_sarah, CURRENT_TIMESTAMP
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM bugs WHERE id = '99999999-9999-9999-9999-999999999903');

INSERT IGNORE INTO bug_comments (id, organization_id, bug_id, author_id, kind, body)
VALUES
  ('99999999-9999-9999-9999-99999999c001', @org_id, '99999999-9999-9999-9999-999999999901', @user_sarah, 'event', 'reported this bug'),
  ('99999999-9999-9999-9999-99999999c002', @org_id, '99999999-9999-9999-9999-999999999901', @user_alex, 'event', 'assigned this bug to David Kim'),
  ('99999999-9999-9999-9999-99999999c003', @org_id, '99999999-9999-9999-9999-999999999901', @user_david, 'comment', 'Reproduced. It comes from the payment script loading before the cart. Working on a fix.'),
  ('99999999-9999-9999-9999-99999999c004', @org_id, '99999999-9999-9999-9999-999999999902', @user_david, 'event', 'reported this bug'),
  ('99999999-9999-9999-9999-99999999c005', @org_id, '99999999-9999-9999-9999-999999999903', @user_alex, 'event', 'reported this bug'),
  ('99999999-9999-9999-9999-99999999c006', @org_id, '99999999-9999-9999-9999-999999999903', @user_sarah, 'event', 'marked this Resolved (Fixed)');
