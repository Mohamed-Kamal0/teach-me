import { chromium } from 'playwright';

// SMOKE_BASE points the same script at the deployed site, e.g.
//   SMOKE_BASE=https://<app>.vercel.app node smoke.mjs
const BASE = process.env.SMOKE_BASE ?? 'http://localhost:4200';
const SHOT = process.env.SMOKE_SHOTS ?? './smoke-shots';

const results = [];
function ok(name, detail = '') { results.push(`PASS  ${name}${detail ? ' — ' + detail : ''}`); }
function bad(name, detail = '') { results.push(`FAIL  ${name}${detail ? ' — ' + detail : ''}`); }

const browser = await chromium.launch();
const consoleErrors = [];

async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));
  return { ctx, page };
}

async function login(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[formcontrolname="email"]', email);
  await page.fill('input[formcontrolname="password"]', password);
  await page.click('button[type="submit"]');
  // Wait for the app to actually route away from /login — networkidle can fire before the
  // login POST has even started, and navigating early throws away the session cookie.
  await page.waitForURL(u => !u.pathname.endsWith('/login'), { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

// ---------- 1. Public home page, signed out ----------
{
  const { ctx, page } = await newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  const body = await page.textContent('body');
  if (body.includes('approved teachers') && body.includes('lessons published')) {
    ok('Home page renders counts against the database');
  } else {
    bad('Home page', body.slice(0, 200));
  }
  await page.screenshot({ path: `${SHOT}/01-home.png`, fullPage: true });
  await ctx.close();
}

// ---------- 2. Admin: approvals, decide-once ----------
{
  const { ctx, page } = await newPage();
  await login(page, 'admin@teacherslessons.test', 'Admin1234');
  const url = page.url();
  if (url.includes('/admin/approvals')) ok('Admin lands on approvals after sign-in');
  else bad('Admin landing', url);

  await page.waitForTimeout(800);
  const body = await page.textContent('body');
  if (body.includes('Karim Aziz')) ok('Pending teacher listed for the administrator');
  else bad('Pending teacher list', body.slice(0, 300));
  await page.screenshot({ path: `${SHOT}/02-admin-approvals.png`, fullPage: true });
  await ctx.close();
}

// ---------- 3. Pending teacher is refused everything but their standing ----------
{
  const { ctx, page } = await newPage();
  await login(page, 'teacher.pending@demo.test', 'Demo1234');
  await page.waitForTimeout(500);
  let body = await page.textContent('body');
  if (body.includes('waiting')) ok('Pending teacher sees the waiting screen');
  else bad('Pending standing', body.slice(0, 300));
  await page.screenshot({ path: `${SHOT}/03-teacher-pending.png`, fullPage: true });

  // Try to reach lessons directly — the guard should bounce them back to standing.
  await page.goto(`${BASE}/teacher/lessons`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  if (page.url().includes('/teacher/standing')) ok('Pending teacher is bounced away from lessons');
  else bad('Pending teacher guard', page.url());
  await ctx.close();
}

// ---------- 4. Rejected teacher is told, and when ----------
{
  const { ctx, page } = await newPage();
  await login(page, 'teacher.rejected@demo.test', 'Demo1234');
  await page.waitForTimeout(500);
  const body = await page.textContent('body');
  if (body.includes('not approved') || body.includes('turned this registration away')) {
    ok('Rejected teacher is told they were refused');
  } else {
    bad('Rejected standing', body.slice(0, 300));
  }
  await page.screenshot({ path: `${SHOT}/04-teacher-rejected.png`, fullPage: true });
  await ctx.close();
}

// ---------- 5. Approved teacher: lessons list in real order, moments shown ----------
let joinCode = null;
{
  const { ctx, page } = await newPage();
  await login(page, 'teacher.approved@demo.test', 'Demo1234');
  await page.goto(`${BASE}/teacher/lessons`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  const body = await page.textContent('body');
  if (body.includes('Introduction to Algebra') && body.includes('Linear Equations')) {
    ok('Approved teacher sees their lessons');
  } else {
    bad('Teacher lessons', body.slice(0, 400));
  }
  if (body.includes('Open') && body.includes('Not open')) ok('Lesson moments rendered as chips');
  else bad('Lesson moment chips');
  await page.screenshot({ path: `${SHOT}/05-teacher-lessons.png`, fullPage: true });

  // Students screen — join code must be copyable/visible
  await page.goto(`${BASE}/teacher/students`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  const sbody = await page.textContent('body');
  const m = sbody.match(/joining code:\s*([0-9A-Z]{8})/i);
  if (m) { joinCode = m[1]; ok('Teacher join code visible', joinCode); }
  else bad('Join code', sbody.slice(0, 300));
  await page.screenshot({ path: `${SHOT}/06-teacher-students.png`, fullPage: true });

  await page.goto(`${BASE}/teacher/progress`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SHOT}/07-teacher-progress.png`, fullPage: true });
  const pbody = await page.textContent('body');
  if (pbody.includes('Class progress')) ok('Class progress screen renders');
  else bad('Class progress', pbody.slice(0, 200));
  await ctx.close();
}

// ---------- 6. Student: courses, timing enforcement visible in the UI ----------
{
  const { ctx, page } = await newPage();
  await login(page, 'student.one@demo.test', 'Demo1234');
  if (page.url().includes('/student/profile')) ok('Student lands on their profile');
  else bad('Student landing', page.url());
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOT}/08-student-profile.png`, fullPage: true });

  await page.goto(`${BASE}/student/courses`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  const body = await page.textContent('body');
  if (body.includes('Amina Farouk') && body.includes('Youssef Adel')) {
    ok('Student on two courses sees both');
  } else {
    bad('Student courses', body.slice(0, 400));
  }
  await page.screenshot({ path: `${SHOT}/09-student-courses.png`, fullPage: true });

  // Open the first course and confirm quiz-not-open state is shown as a WORD, not a dead control.
  await page.click('text=Amina Farouk');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1200);
  const cbody = await page.textContent('body');
  if (cbody.includes('Quadratic Equations')) ok('Open lessons listed for the course');
  else bad('Course lessons', cbody.slice(0, 400));
  if (cbody.includes('Graphing Functions')) bad('LEAK: an unopened lesson appeared in the UI');
  else ok('Unopened lesson is absent from the course view');

  // Expand the lesson whose quiz has NOT opened — Req 16: a message saying when, never a dead control.
  await page.click('text=Quadratic Equations');
  await page.waitForTimeout(900);
  const panel = await page.textContent('mat-expansion-panel:has-text("Quadratic Equations")');
  if (/Quiz opens/i.test(panel)) ok('Unopened quiz shows when it opens, not a dead control');
  else bad('Quiz timing message', panel.slice(0, 300));
  const quizLinks = await page.locator('mat-expansion-panel:has-text("Quadratic Equations") a:has-text("Quiz")').count();
  if (quizLinks === 0) ok('No quiz link is rendered before its moment');
  else bad('LEAK: quiz link rendered before its moment');
  await page.screenshot({ path: `${SHOT}/10-student-course.png`, fullPage: true });

  await page.goto(`${BASE}/student/whats-new`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SHOT}/11-student-whats-new.png`, fullPage: true });
  const wbody = await page.textContent('body');
  if (wbody.includes("What's new")) ok("What's-new screen renders");
  else bad("What's new", wbody.slice(0, 200));

  await page.goto(`${BASE}/student/marks`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SHOT}/12-student-marks.png`, fullPage: true });

  // Helper widget
  await page.goto(`${BASE}/student/courses`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const fab = page.locator('button.fab');
  if (await fab.count() > 0) {
    await fab.click();
    await page.waitForTimeout(400);
    await page.fill('input[name="question"]', 'where are my results');
    await page.click('.panel-form button[type="submit"]');
    await page.waitForTimeout(900);
    const hbody = await page.textContent('.panel-body');
    if (hbody.toLowerCase().includes('marks')) ok('Helper answers a known question', hbody.trim().slice(0, 60));
    else bad('Helper answer', hbody.slice(0, 200));
    await page.screenshot({ path: `${SHOT}/13-helper.png`, fullPage: true });
  } else {
    bad('Helper FAB not rendered');
  }
  await ctx.close();
}

// ---------- 7. Signed-out user cannot reach a protected screen ----------
{
  const { ctx, page } = await newPage();
  await page.goto(`${BASE}/teacher/lessons`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  if (page.url().includes('/login')) ok('Signed-out user is redirected to sign in');
  else bad('Auth guard', page.url());
  await ctx.close();
}

// ---------- 8. Not-found screen ----------
{
  const { ctx, page } = await newPage();
  await page.goto(`${BASE}/this/does/not/exist`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const body = await page.textContent('body');
  if (body.includes("couldn't find that page")) ok('Unknown route shows the not-found screen');
  else bad('Not found', body.slice(0, 200));
  await page.screenshot({ path: `${SHOT}/14-not-found.png`, fullPage: true });
  await ctx.close();
}

await browser.close();

console.log('\n=== SMOKE RESULTS ===');
results.forEach(r => console.log(r));
const failures = results.filter(r => r.startsWith('FAIL'));
console.log(`\n${results.length - failures.length}/${results.length} checks passed`);
if (consoleErrors.length) {
  console.log('\n=== CONSOLE ERRORS ===');
  [...new Set(consoleErrors)].slice(0, 20).forEach(e => console.log('  ' + e));
}
process.exit(failures.length ? 1 : 0);
