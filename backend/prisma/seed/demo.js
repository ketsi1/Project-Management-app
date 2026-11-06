// The Acme Corp demo data (projects, tasks, bugs) with fixed ids. Safe to run repeatedly:
// it only adds demo rows that are missing and never changes rows that exist, so renaming the
// organization, editing tasks or changing a demo user's password or role is kept.
import { ensureDefaultRoles, findRoleBySlug } from '../../src/services/accessControl.js'
import { daysFromToday } from '../../src/utils/time.js'

const ORG = '11111111-1111-1111-1111-111111111111'
const ALEX = '22222222-2222-2222-2222-222222222222'
const SARAH = '33333333-3333-3333-3333-333333333333'
const DAVID = '44444444-4444-4444-4444-444444444444'
const TODO = '33333333-3333-3333-3333-333333333301'
const DOING = '33333333-3333-3333-3333-333333333302'
const REVIEW = '33333333-3333-3333-3333-333333333303'
const DONE = '33333333-3333-3333-3333-333333333304'
const DEPT = '66666666-6666-6666-6666-666666666661'
const HOURS = '66666666-6666-6666-6666-666666666662'
const WEB = '55555555-5555-5555-5555-555555555551'
const APP = '55555555-5555-5555-5555-555555555552'

// bcrypt (cost 10) hashes: alex → 87654321, sarah → 12345678, david → 21345678
const USERS = [
  { id: ALEX, fullName: 'Alex Morgan', email: 'alex@acme.com', role: 'owner', membership: '77777777-7777-7777-7777-777777777771', passwordHash: '$2b$10$Mh8tEkMqRUgVNfqqNGNQXOsQeqES3DHVe4mgj.rmrNcwqtr84ZL/.' },
  { id: SARAH, fullName: 'Sarah Connor', email: 'sarah@acme.com', role: 'member', membership: '77777777-7777-7777-7777-777777777772', passwordHash: '$2b$10$ThS6NBJj60V3IXoEHCLg6eiR5wT2wcjeqg9KKvhZkZQfxQkZtoxLu' },
  { id: DAVID, fullName: 'David Kim', email: 'david@acme.com', role: 'member', membership: '77777777-7777-7777-7777-777777777773', passwordHash: '$2b$10$jCERyCFbg/RT.caB47qIsO4ayeysGze7HCxNEmZabVWhRCUxu8Pey' },
]

const STATUSES = [
  { id: TODO, name: 'To do', category: 'not_started', color: '#94a3b8', position: 0 },
  { id: DOING, name: 'In progress', category: 'active', color: '#3b82f6', position: 1 },
  { id: REVIEW, name: 'In review', category: 'active', color: '#f59e0b', position: 2 },
  { id: DONE, name: 'Done', category: 'done', color: '#22c55e', position: 3 },
]

const FIELDS = [
  { id: DEPT, label: 'Department', type: 'select', options: ['Engineering', 'Design', 'Management', 'QA'] },
  { id: HOURS, label: 'Est. Hours', type: 'number', options: [] },
]

const PROJECTS = [
  { id: WEB, name: 'Website Redesign & Launch', description: 'Modernize marketing site, design new dashboard experience and deploy to production.' },
  { id: APP, name: 'Mobile App MVP', description: 'Native iOS and Android client for on-the-go project tracking and real-time alerts.' },
]

// Alex (the owner) created every sample task, so members can change their status but not edit them.
const TASKS = [
  [1, WEB, 'Design responsive mockups & component tokens', 'Create high-fidelity Figma screens for both desktop and mobile breakpoints.', DOING, 'high', DAVID, 3, 'Design', '16'],
  [2, WEB, 'Build interactive Employee Workstation view', 'Implement personal task queue, daily focus mode, and 1-click status transitions.', DOING, 'urgent', SARAH, 2, 'Engineering', '20'],
  [3, WEB, 'Executive Manager Command Center & Team Matrix', 'Provide portfolio health metrics, team capacity distribution, and project controls.', DONE, 'high', SARAH, -1, 'Engineering', '18'],
  [4, WEB, 'Review project milestones & budget with stakeholders', 'Executive quarterly sync to approve budget allocation and Q4 roadmap.', REVIEW, 'high', ALEX, 5, 'Management', '6'],
  [5, WEB, 'Set up automated CI/CD deployment pipeline', 'Configure GitHub Actions test suite and automated staging deploy.', TODO, 'medium', SARAH, 7, 'Engineering', '12'],
  [6, APP, 'Mobile app user onboarding wireframes & flows', 'Design step-by-step account activation and workspace creation flow for phone screens.', DONE, 'high', DAVID, -2, 'Design', '14'],
  [7, APP, 'Implement push notification service integration', 'Send instant notifications when task status changes or when a user is assigned work.', TODO, 'medium', SARAH, 4, 'Engineering', '15'],
  [8, APP, 'Team sprint capacity allocation & project plan', 'Align cross-functional team bandwidth for mobile MVP release.', DOING, 'high', ALEX, 1, 'Management', '8'],
  [9, APP, 'Design dark mode palette and icon set', 'Ensure contrast compliance for WCAG AAA and export SVG icon assets.', REVIEW, 'low', DAVID, 6, 'Design', '10'],
  [10, APP, 'Conduct sprint retrospective & team feedback', 'Collect feedback on velocity and process improvements.', TODO, 'low', ALEX, 8, 'Management', '4'],
]

const BUGS = [
  {
    id: '99999999-9999-9999-9999-999999999901',
    projectId: WEB,
    title: 'Checkout button does nothing on Safari',
    description: 'Customers on Safari cannot finish an order.',
    stepsToReproduce: '1. Open the site in Safari 17\n2. Add any product to the cart\n3. Click "Checkout"',
    expectedResult: 'The checkout page opens.',
    actualResult: 'Nothing happens. The console shows "TypeError: undefined is not an object".',
    environment: 'Safari 17 / macOS 14',
    severity: 'critical',
    priority: 'urgent',
    status: 'in_progress',
    reporterId: SARAH,
    assigneeId: DAVID,
    log: [
      ['c001', SARAH, 'event', 'reported this bug'],
      ['c002', ALEX, 'event', 'assigned this bug to David Kim'],
      ['c003', DAVID, 'comment', 'Reproduced. It comes from the payment script loading before the cart. Working on a fix.'],
    ],
  },
  {
    id: '99999999-9999-9999-9999-999999999902',
    projectId: WEB,
    title: 'Footer links overlap on small phones',
    description: '',
    stepsToReproduce: '1. Open the home page on a 320px wide screen\n2. Scroll to the footer',
    expectedResult: 'Links wrap onto separate lines.',
    actualResult: 'Links overlap and cannot be tapped.',
    environment: 'iPhone SE, Chrome',
    severity: 'minor',
    priority: 'low',
    status: 'open',
    reporterId: DAVID,
    assigneeId: null,
    log: [['c004', DAVID, 'event', 'reported this bug']],
  },
  {
    id: '99999999-9999-9999-9999-999999999903',
    projectId: APP,
    title: 'App crashes when uploading a profile photo',
    description: 'Happens with photos larger than 10 MB.',
    stepsToReproduce: '1. Open Profile\n2. Tap "Change photo"\n3. Choose a photo over 10 MB',
    expectedResult: 'The photo is resized and saved.',
    actualResult: 'The app closes.',
    environment: 'Android 14, app v0.3.1',
    severity: 'major',
    priority: 'high',
    status: 'resolved',
    resolution: 'fixed',
    resolvedAt: new Date(),
    reporterId: ALEX,
    assigneeId: SARAH,
    log: [
      ['c005', ALEX, 'event', 'reported this bug'],
      ['c006', SARAH, 'event', 'marked this Resolved (Fixed)'],
    ],
  },
]

export async function seedDemoData(db) {
  await db.organization.upsert({
    where: { id: ORG },
    create: { id: ORG, name: 'Acme Corp' },
    update: {},
  })
  await ensureDefaultRoles(db, ORG)

  for (const u of USERS) {
    await db.user.upsert({
      where: { id: u.id },
      create: { id: u.id, fullName: u.fullName, email: u.email, passwordHash: u.passwordHash },
      update: {},
    })
    const role = await findRoleBySlug(ORG, u.role, db)
    await db.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: ORG, userId: u.id } },
      create: { id: u.membership, organizationId: ORG, userId: u.id, roleId: role.id, status: 'active' },
      update: {},
    })
  }

  for (const s of STATUSES) {
    await db.status.upsert({ where: { id: s.id }, create: { ...s, organizationId: ORG }, update: {} })
  }
  for (const f of FIELDS) {
    await db.customField.upsert({ where: { id: f.id }, create: { ...f, organizationId: ORG }, update: {} })
  }
  for (const p of PROJECTS) {
    await db.project.upsert({ where: { id: p.id }, create: { ...p, organizationId: ORG }, update: {} })
  }

  for (const [n, projectId, title, description, statusId, priority, assigneeId, days, dept, hours] of TASKS) {
    const id = `88888888-8888-8888-8888-8888888888${String(n).padStart(2, '0')}`
    await db.workItem.upsert({
      where: { id },
      create: {
        id,
        organizationId: ORG,
        projectId,
        title,
        description,
        statusId,
        priority,
        assigneeId,
        dueDate: daysFromToday(days),
        customValues: { [DEPT]: dept, [HOURS]: hours },
        createdById: ALEX,
      },
      update: {},
    })
  }

  // Demo bugs are added once; their numbers continue after any bugs that already exist.
  for (const { log, ...bug } of BUGS) {
    if (await db.bug.findUnique({ where: { id: bug.id }, select: { id: true } })) continue
    const last = await db.bug.aggregate({ where: { organizationId: ORG }, _max: { number: true } })
    await db.bug.create({ data: { ...bug, organizationId: ORG, number: (last._max.number ?? 0) + 1 } })
    await db.bugComment.createMany({
      data: log.map(([suffix, authorId, kind, body]) => ({ id: `99999999-9999-9999-9999-99999999${suffix}`, organizationId: ORG, bugId: bug.id, authorId, kind, body })),
      skipDuplicates: true,
    })
  }
}
