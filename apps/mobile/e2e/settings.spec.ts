import { execFileSync } from 'node:child_process';
import { expect, test, signIn, clickVisible } from './support';
import { colors } from '../src/theme/colors';
import type { Page } from '@playwright/test';

const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;
const LIGHT = rgb(colors.light.background);
const DARK = rgb(colors.dark.background);
const KEY = 'plant-care.appearance'; // src/theme/appearance.ts (AsyncStorage is localStorage on web)

// The app paints its background on a View (not on body): read the first opaque colour behind a point near the top-left.
const PROBE = `(() => {
  for (let el = document.elementFromPoint(4, 4); el; el = el.parentElement) {
    const c = getComputedStyle(el).backgroundColor;
    if (c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c;
  }
  return '';
})()`;
const background = (page: Page) => page.evaluate(PROBE) as Promise<string>;
const openSettings = (page: Page) => page.getByRole('link', { name: 'Settings' }).or(page.getByRole('button', { name: 'Settings' })).filter({ visible: true }).click();

test('I1 appearance persists across a reload', async ({ page, user }) => {
  expect(DARK).not.toBe(LIGHT);
  await signIn(page, user);
  await expect.poll(() => background(page)).toBe(LIGHT); // light by default
  await openSettings(page);
  await clickVisible(page, 'Dark');
  await expect.poll(() => background(page)).toBe(DARK);
  await page.reload();
  await expect.poll(() => background(page)).toBe(DARK);
});

test('A3 stored dark shows dark from the first frame', async ({ page, browser, baseURL, user }) => {
  // Records the app's background in every animation frame from document start.
  const sampler = `window.__bg = []; (function tick() { window.__bg.push(${PROBE}); requestAnimationFrame(tick); })();`;
  await signIn(page, user); // the session is stored; the reload below starts with the dark choice
  await page.addInitScript(([key]) => localStorage.setItem(key, 'dark'), [KEY]);
  await page.addInitScript(sampler);
  await page.reload();
  await expect.poll(() => background(page)).toBe(DARK);
  const frames = await page.evaluate(() => (window as unknown as { __bg: string[] }).__bg);
  expect(frames).toContain(DARK);
  expect(frames).not.toContain(LIGHT);

  // Positive control: with nothing stored the same sampler does see the light token.
  const ctx = await browser.newContext({ baseURL });
  const control = await ctx.newPage();
  await control.addInitScript(sampler);
  await control.goto('/');
  await expect.poll(() => background(control)).toBe(LIGHT);
  const lightFrames = await control.evaluate(() => (window as unknown as { __bg: string[] }).__bg);
  expect(lightFrames).toContain(LIGHT);
  expect(lightFrames).not.toContain(DARK);
  await ctx.close();
});

test('I2 units: Metric is saved on the profile', async ({ page, user }) => {
  // service_role has no access to profiles, so read through the DB container.
  const units = () =>
    execFileSync('docker', ['exec', '-i', 'supabase_db_plant-care', 'psql', '-U', 'postgres', '-tA'], {
      input: `select units from public.profiles where user_id = '${user.id}';`,
      encoding: 'utf8',
    }).trim();
  await signIn(page, user);
  await openSettings(page);
  expect(units()).not.toBe('metric');
  expect(units()).not.toBe('');
  await clickVisible(page, 'Metric');
  await expect.poll(units).toBe('metric');
});

test('I3 I4 plan and account show on Settings', async ({ page, user }) => {
  await signIn(page, user);
  await openSettings(page);
  await expect(page.getByText('Free (testing)')).toBeVisible();
  await expect(page.getByText(user.email, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible(); // signing out itself is B9
});
