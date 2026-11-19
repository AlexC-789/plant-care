import { expect, test, signIn, clickVisible } from './support';
import type { Page, Route } from '@playwright/test';

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const now = () => ago(0);
const HOUR = 3_600_000;
// Home's list query is the only plants request that embeds devices; detail reads plants by id.
const isList = (url: string) => /\/rest\/v1\/plants\?/.test(url) && /devices/.test(decodeURIComponent(url));
// postgrest-js retries aborted GETs for ~7 s, so a failed load is simulated with a 500 (not retried) to keep tests fast.
const down = { status: 500, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: '{"message":"down"}' };

const STATUSES = [
  { key: 'setup', device: null, line: "Setup isn't finished · Add its module" },
  { key: 'waiting', device: { last_seen_at: now(), reading_ts: null }, line: 'Waiting for its first check-in' },
  { key: 'fault', device: { fault_code: 'no_moisture_rise', last_seen_at: now() }, line: 'Watering stopped · Check the stake is in the soil' },
  { key: 'tank', device: { float_low: true, last_seen_at: now() }, line: 'Tank needs refilling' },
  { key: 'offline', device: { last_seen_at: ago(4 * HOUR), sync_interval_s: 3600 }, line: /^Not heard from since/ },
  { key: 'wet', device: { reading_ts: now(), last_seen_at: now(), soil_pct: 70 }, line: 'Soil is very wet · Watering is on hold' },
  { key: 'battery', device: { reading_ts: now(), last_seen_at: now(), soil_pct: 45, battery_pct: 10 }, line: 'Battery is low · Charge it this week' },
  { key: 'fine', device: { reading_ts: now(), last_seen_at: now(), soil_pct: 45, battery_pct: 80 }, line: 'Doing well · Still learning how fast it drinks' },
] as const;

// Row name is "name, status line"; a RegExp line matches by prefix.
const row = (page: Page, name: string, line: string | RegExp = /./) =>
  page
    .getByRole('button', { name: typeof line === 'string' ? `${name}, ${line}` : new RegExp(`^${name}, ${line.source.replace('^', '')}`), exact: typeof line === 'string' })
    .filter({ visible: true });

test('C1 empty library', async ({ page, user }) => {
  await signIn(page, user);
  await expect(page.getByText('No plants yet')).toBeVisible();
  await page.getByRole('button', { name: 'Add a pot' }).filter({ visible: true }).last().click(); // the empty state's own button
  await expect(page.getByRole('heading', { name: 'Take a photo of your plant' })).toBeVisible();
});

test('C2 loading skeleton shows after a delay, then rows', async ({ page, user, admin }) => {
  await admin.seedPlant(user.id, { name: 'Slow fern' });
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await page.route('**/rest/v1/plants*', async (r) => {
    if (r.request().method() === 'GET' && isList(r.request().url())) await gate;
    await r.continue();
  });
  await page.goto('/');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByLabel('Loading', { exact: true })).toBeVisible();
  await expect(page.getByText('Slow fern')).toHaveCount(0); // the request is still held
  release();
  await expect(row(page, 'Slow fern')).toBeVisible();
  await expect(page.getByLabel('Loading', { exact: true })).toHaveCount(0);
});

test('C3 failed load with no cache offers Try again', async ({ page, user, admin }) => {
  await admin.seedPlant(user.id, { name: 'Retry fern' });
  let aborted = 0;
  const fail = (r: Route) => (r.request().method() === 'GET' && isList(r.request().url()) ? (aborted++, r.fulfill(down)) : r.continue());
  await page.route('**/rest/v1/plants*', fail);
  await page.goto('/');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText("Couldn't reach Plant Care. Check your connection and try again.")).toBeVisible();
  expect(aborted).toBeGreaterThan(0);
  await expect(page.getByText('Retry fern')).toHaveCount(0);
  await page.unroute('**/rest/v1/plants*', fail);
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(row(page, 'Retry fern')).toBeVisible();
  await expect(page.getByText("Couldn't reach Plant Care.")).toHaveCount(0);
});

test('C4 cached rows stay when a later refresh fails', async ({ page, user, admin }) => {
  await admin.seedPlant(user.id, { name: 'Cached fern' });
  await signIn(page, user);
  await expect(row(page, 'Cached fern')).toBeVisible();
  let aborted = 0;
  await page.route('**/rest/v1/plants*', (r) => (r.request().method() === 'GET' && isList(r.request().url()) ? (aborted++, r.fulfill(down)) : r.continue()));
  // Refocusing Home refetches the list; the cache is in memory only, so no page reload.
  await row(page, 'Cached fern').click();
  await expect(page.getByRole('heading', { name: 'Cached fern' })).toBeVisible();
  await page.goBack();
  await expect.poll(() => aborted).toBeGreaterThanOrEqual(2); // the refresh failed and its one retry too
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); // let the error state render
  await expect(row(page, 'Cached fern')).toBeVisible();
  await expect(page.getByText("Couldn't reach Plant Care.")).toHaveCount(0);
});

test('C5 C6 @pr each status shows its line and section', async ({ page, user, admin }) => {
  for (const s of STATUSES) {
    const p = await admin.seedPlant(user.id, { name: `Plant ${s.key}` });
    if (s.device) await admin.seedDevice(user.id, p.id, s.device);
  }
  await signIn(page, user);
  for (const s of STATUSES) await expect(row(page, `Plant ${s.key}`, s.line)).toBeVisible();
  // Everything but fine needs you.
  await expect(page.getByText('7 need you · 1 doing well')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Needs you' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Doing well' })).toBeVisible();
  // Section membership by vertical position: needs-you rows sit between the two headings, "Plant fine" below the second.
  const top = async (l: import('@playwright/test').Locator) => (await l.boundingBox())!.y;
  const needs = await top(page.getByRole('heading', { name: 'Needs you' }));
  const well = await top(page.getByRole('heading', { name: 'Doing well' }));
  expect(needs).toBeLessThan(well);
  for (const s of STATUSES) {
    const y = await top(row(page, `Plant ${s.key}`, s.line));
    if (s.key === 'fine') expect(y).toBeGreaterThan(well);
    else {
      expect(y).toBeGreaterThan(needs);
      expect(y).toBeLessThan(well);
    }
  }
});

test('C7 paging loads the next page at the end of the list', async ({ page, user, admin }) => {
  test.setTimeout(120_000);
  // Newest first: seed 45 down to 1 so Plant 45 is the last row.
  for (let i = 1; i <= 45; i++) await admin.seedPlant(user.id, { name: `Plant ${String(46 - i).padStart(2, '0')}` });
  await signIn(page, user);
  await expect(row(page, 'Plant 01')).toBeVisible();
  await expect(page.getByText('Plant 45', { exact: true })).toHaveCount(0); // not on the first pages
  await expect
    .poll(async () => {
      await row(page, 'Plant \\d+').last().scrollIntoViewIfNeeded(); // scrolls whatever ancestor scrolls; each new row batch moves the end
      return page.getByText('Plant 45', { exact: true }).filter({ visible: true }).count();
    }, { timeout: 30_000 })
    .toBe(1);
});

test('C8 refocus shows a plant added meanwhile', async ({ page, user, admin }) => {
  await admin.seedPlant(user.id, { name: 'First fern' });
  await signIn(page, user);
  await expect(row(page, 'First fern')).toBeVisible();
  await admin.seedPlant(user.id, { name: 'Second fern' });
  await expect(page.getByText('Second fern')).toHaveCount(0);
  await row(page, 'First fern').click();
  await expect(page.getByRole('heading', { name: 'First fern' })).toBeVisible();
  await page.goBack();
  await expect(row(page, 'Second fern')).toBeVisible();
});

test('C9 header buttons open Add and Settings', async ({ page, user, admin }) => {
  await admin.seedPlant(user.id, { name: 'Any fern' });
  await signIn(page, user);
  await clickVisible(page, 'Add a pot');
  await expect(page.getByRole('heading', { name: 'Take a photo of your plant' })).toBeVisible();
  await page.goBack();
  await page.getByRole('link', { name: 'Settings' }).click(); // a link on web
  await expect(page.getByText('Appearance', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
});
