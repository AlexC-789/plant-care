import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, signIn, clickVisible, startSim, type Admin, type TestUser } from './support';
import type { Page } from '@playwright/test';

const CODE = /^[A-Z0-9]{4} [A-Z0-9]{4} [A-Z0-9]{4}$/;
const SIM_DEVICES = join(__dirname, '../../../sim/.devices');
const simName = () => `e2e-${randomUUID().slice(0, 8)}`;
const count = async (admin: Admin, path: string) => ((await (await admin.rest(`/rest/v1/${path}`)).json()) as unknown[]).length;

async function openDetail(page: Page, name: string) {
  await page.getByRole('button', { name: new RegExp(`^${name},`) }).filter({ visible: true }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
}

/** Sign in, open a plant without a module and go to its setup screen; returns the code shown. */
async function openSetup(page: Page, user: TestUser, admin: Admin, name: string): Promise<{ plantId: string; code: string }> {
  const p = await admin.seedPlant(user.id, { name });
  await signIn(page, user);
  await openDetail(page, name);
  await page.getByRole('button', { name: 'Add its module' }).filter({ visible: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Add its module' })).toBeVisible();
  return { plantId: p.id, code: await readCode(page) };
}

async function readCode(page: Page): Promise<string> {
  const el = page.getByText(CODE).filter({ visible: true });
  await expect(el).toBeVisible();
  return (await el.textContent())!.replaceAll(' ', '');
}

test('F1 @pr claim with the simulator', async ({ page, user, admin }) => {
  const { plantId, code } = await openSetup(page, user, admin, 'Claim fern');
  expect(await count(admin, `devices?select=id&plant_id=eq.${plantId}`)).toBe(0); // positive control: no module before the claim
  // Home stays mounted (hidden) under the stack: before the claim its row says setup is unfinished.
  const homeRow = page.getByRole('button', { name: /^Claim fern,/, includeHidden: true });
  await expect(homeRow).toHaveAttribute('aria-label', /Setup isn't finished/); // hidden, so read the label (RN web sets aria-label)
  const sim = await startSim({ code, name: simName() }); // scenario normal: empty tank
  try {
    await expect(page.getByRole('heading', { name: 'Fill the tank' })).toBeVisible({ timeout: 30_000 });
    expect(await count(admin, `devices?select=id&plant_id=eq.${plantId}`)).toBe(1);
    await clickVisible(page, 'Done');
    await expect(page.getByRole('heading', { name: 'Claim fern' })).toBeVisible();
    await page.goBack();
    const row = page.getByRole('button', { name: /^Claim fern,/ }).filter({ visible: true });
    await expect(row).toBeVisible();
    await expect(row).not.toHaveAttribute('aria-label', /Setup isn't finished/);
  } finally {
    await sim.stop();
  }
});

test('F4 @pr fill the tank', async ({ page, user, admin }) => {
  const { code } = await openSetup(page, user, admin, 'Full fern');
  // drought starts with a full tank (normal starts empty)
  // The message shows for only 700 ms, so catch it with an observer installed before the sim can fill the tank.
  await page.evaluate(() => {
    const w = window as unknown as { sawFull: boolean };
    w.sawFull = false;
    new MutationObserver(() => {
      if (document.body.textContent?.includes('The tank is full.')) w.sawFull = true;
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  });
  const sim = await startSim({ code, name: simName(), scenario: 'drought' });
  try {
    await expect.poll(() => page.evaluate(() => (window as unknown as { sawFull: boolean }).sawFull), { timeout: 30_000 }).toBe(true);
    await expect(page.getByRole('heading', { name: 'Full fern' })).toBeVisible(); // returns to detail
    await expect(page.getByText('The tank is full.')).toHaveCount(0);
  } finally {
    await sim.stop();
  }
});

test('F4 @pr Done before the tank is full returns to detail', async ({ page, user, admin }) => {
  const { code } = await openSetup(page, user, admin, 'Early fern');
  const sim = await startSim({ code, name: simName() }); // empty tank
  try {
    await expect(page.getByRole('heading', { name: 'Fill the tank' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('The tank is full.')).toHaveCount(0);
    await clickVisible(page, 'Done');
    await expect(page.getByRole('heading', { name: 'Fill the tank' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Early fern' })).toBeVisible();
  } finally {
    await sim.stop();
  }
});

test('F2 code expires', async ({ page, user, admin }) => {
  await page.clock.install(); // before the page loads
  const { code } = await openSetup(page, user, admin, 'Expiry fern');
  await expect(page.getByText('This code expired.')).toHaveCount(0); // positive control: fresh code
  await page.clock.fastForward('16:00');
  await expect(page.getByText('This code expired.')).toBeVisible();
  await expect(page.getByText(CODE)).toHaveCount(0);
  await page.clock.setSystemTime(new Date()); // back to real time so the fresh code is not already expired
  const issued = page.waitForResponse((r) => r.url().includes('/rest/v1/device_claims') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'New code' }).click();
  const fresh = ((await (await issued).json()) as { code: string }).code;
  expect(fresh).toMatch(/^[A-Z0-9]{12}$/);
  expect(fresh).not.toBe(code);
  await expect(page.getByText(CODE).filter({ visible: true })).toBeVisible({ timeout: 10_000 }); // the 5 s tick refreshes "now"
  expect(await readCode(page)).toBe(fresh);
  await expect(page.getByText('This code expired.')).toHaveCount(0);
});

test('F3 code failure', async ({ page, user, admin }) => {
  await admin.seedPlant(user.id, { name: 'Failing fern' });
  await signIn(page, user);
  await openDetail(page, 'Failing fern');
  let failed = 0;
  await page.route('**/rest/v1/device_claims*', (r) => (r.request().method() === 'POST' && failed++ === 0 ? r.abort() : r.continue()));
  await page.getByRole('button', { name: 'Add its module' }).filter({ visible: true }).first().click();
  await expect(page.getByText("Couldn't make a code. Try again.")).toBeVisible();
  expect(failed).toBe(1);
  await expect(page.getByText(CODE)).toHaveCount(0);
  await page.getByRole('button', { name: 'Try again' }).click();
  await readCode(page);
  await expect(page.getByText("Couldn't make a code. Try again.")).toHaveCount(0);
  expect(failed).toBe(2);
});

for (const s of [
  { scenario: 'tank-empty', fills: true, banner: "The tank needs refilling. Watering is paused until it's filled." },
  { scenario: 'battery-low', fills: false, banner: 'Battery is low. Charge it this week.' },
]) {
  test(`F5 @pr simulator state ${s.scenario} reaches the app`, async ({ page, user, admin }) => {
    test.setTimeout(120_000);
    const { code } = await openSetup(page, user, admin, `Sim ${s.scenario}`);
    const sim = await startSim({ code, name: simName(), scenario: s.scenario, from: '6h', speed: 600 });
    try {
      // battery-low starts with a full tank, so setup returns to detail by itself; tank-empty waits on the fill screen.
      if (s.fills) {
        await expect(page.getByRole('heading', { name: 'Fill the tank' })).toBeVisible({ timeout: 30_000 });
        await clickVisible(page, 'Done');
      }
      await expect(page.getByRole('heading', { name: `Sim ${s.scenario}` })).toBeVisible({ timeout: 30_000 });
      const banner = page.getByText(s.banner).filter({ visible: true });
      await expect.poll(async () => banner.count(), { intervals: [2_000], timeout: 60_000 }).toBe(1);
    } finally {
      await sim.stop();
    }
  });
}

test('F7 @pr remove module unpairs the simulator', async ({ page, user, admin }) => {
  test.setTimeout(120_000);
  const { plantId, code } = await openSetup(page, user, admin, 'Unpair fern');
  // Fast catch-up keeps its sync cadence short, so the two 410s come quickly.
  const name = simName();
  const sim = await startSim({ code, name, from: '1d', speed: 600 });
  try {
    await expect(page.getByRole('heading', { name: 'Fill the tank' })).toBeVisible({ timeout: 30_000 });
    await clickVisible(page, 'Done');
    await expect(page.getByRole('heading', { name: 'Unpair fern' })).toBeVisible();
    expect(await count(admin, `devices?select=id&plant_id=eq.${plantId}`)).toBe(1); // positive control
    await clickVisible(page, 'More options');
    await clickVisible(page, 'Remove module');
    await clickVisible(page, 'Remove');
    await expect(page.getByRole('button', { name: 'Add its module' }).filter({ visible: true }).first()).toBeVisible();
    expect(await count(admin, `devices?select=id&plant_id=eq.${plantId}`)).toBe(0);
    let timer!: NodeJS.Timeout;
    const timeout = new Promise<string>((r) => (timer = setTimeout(() => r('timeout'), 60_000)));
    // Exit code 0 and the state file gone happen only after the second 410.
    expect(await Promise.race([sim.exited, timeout]).finally(() => clearTimeout(timer))).toBe(0);
    expect(existsSync(join(SIM_DEVICES, `${name}.json`))).toBe(false);
  } finally {
    await sim.stop();
  }
});
