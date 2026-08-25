// Req 23: stop the API mid-demo and the screen says so — on every screen, not the rehearsed one.
// Two scenarios, because they fail differently:
//   1. The API dies while the app is loaded, and the user navigates within the SPA.
//   2. The user reloads the page with the API already dead (cold boot, no auth state in memory).
import { chromium } from 'playwright';

const BASE = 'http://localhost:4200';
const SHOT = process.env.SHOT_DIR;

const results = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('input[formcontrolname="email"]', 'student.one@demo.test');
await page.fill('input[formcontrolname="password"]', 'Demo1234');
await page.click('button[type="submit"]');
await page.waitForURL(u => !u.pathname.endsWith('/login'), { timeout: 15000 });

// The API goes away. From the app's side this is indistinguishable from the process being killed.
await ctx.route('**/api/**', route => route.abort('connectionrefused'));

// ---- Scenario 1: in-SPA navigation, auth state still in memory ----
const screens = [
  ['Courses', 'Courses'],
  ["What's New", 'WhatsNew'],
  ['Marks', 'Marks'],
  ['Profile', 'Profile']
];

for (const [linkText, slug] of screens) {
  await page.click(`mat-toolbar a:has-text("${linkText}")`);
  await page.waitForTimeout(1400);
  const body = await page.textContent('body');
  const saysSo = /can't reach the server|something went wrong/i.test(body);
  const spinning = await page.locator('mat-spinner').count();
  if (saysSo && spinning === 0) results.push(`PASS  [in-app] ${linkText} shows an error state`);
  else results.push(`FAIL  [in-app] ${linkText} — saysSo=${saysSo} spinners=${spinning} :: ${body.slice(0, 140)}`);
  if (SHOT) await page.screenshot({ path: `${SHOT}/apidown-${slug}.png`, fullPage: true });
}

// ---- Scenario 2: cold reload with the API dead ----
await page.goto(`${BASE}/student/courses`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);
const coldBody = await page.textContent('body');
const coldSaysSo = /can't reach the server/i.test(coldBody);
const dumpedAtLogin = /New here\? Register as a teacher/.test(coldBody);
if (coldSaysSo && !dumpedAtLogin) results.push('PASS  [cold reload] says the server is unreachable, not "signed out"');
else results.push(`FAIL  [cold reload] saysSo=${coldSaysSo} dumpedAtLogin=${dumpedAtLogin} :: ${coldBody.slice(0, 140)}`);
if (SHOT) await page.screenshot({ path: `${SHOT}/apidown-coldreload.png`, fullPage: true });

await browser.close();
results.forEach(r => console.log(r));
const failures = results.filter(r => r.startsWith('FAIL'));
console.log(`\n${results.length - failures.length}/${results.length} checks passed`);
process.exit(failures.length ? 1 : 0);
