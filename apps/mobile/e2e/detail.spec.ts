import { randomUUID } from 'node:crypto';
import { expect, test, signIn, clickVisible, type Admin } from './support';
import type { Page } from '@playwright/test';

const POT = /Drawing of a pot/;
const FERN = 'Adiantum raddianum'; // Maidenhair fern, from the seeded species table

async function fernId(admin: Admin): Promise<string> {
  const r = await admin.rest(`/rest/v1/species?select=id&scientific_name=eq.${encodeURIComponent(FERN)}`);
  return ((await r.json()) as { id: string }[])[0].id;
}
const openDetail = async (page: Page, name: string) => {
  await page.getByRole('button', { name: new RegExp(`^${name},`) }).filter({ visible: true }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
};
const rows = async (admin: Admin, path: string) => (await (await admin.rest(`/rest/v1/${path}`)).json()) as { id: string }[];

test('E1 detail shows name, type, room and a pot drawing without a photo', async ({ page, user, admin }) => {
  const species = await fernId(admin);
  await admin.seedPlant(user.id, { name: 'Frond', room: 'Kitchen', speciesId: species });
  await admin.seedPlant(user.id, { name: 'Snapped', withPhoto: true });
  await signIn(page, user);
  await openDetail(page, 'Frond');
  await expect(page.getByText('Maidenhair fern · Kitchen')).toBeVisible();
  await expect(page.getByRole('img', { name: POT }).filter({ visible: true })).toHaveCount(1);
  await expect(page.getByRole('img', { name: 'Frond photo' })).toHaveCount(0);
  // Control: a plant with a photo shows it and no pot drawing in the hero.
  await page.goBack();
  await openDetail(page, 'Snapped');
  await expect(page.getByRole('img', { name: 'Snapped photo' })).toBeVisible();
  await expect(page.getByRole('img', { name: POT }).filter({ visible: true })).toHaveCount(0);
  // Unknown id.
  await page.goto(`/plant/${randomUUID()}`);
  await expect(page.getByRole('heading', { name: '—' })).toBeVisible();
});

test('E3 @pr menu: edit, remove module, cancel', async ({ page, user, admin }) => {
  const p = await admin.seedPlant(user.id, { name: 'Menu fern' });
  const d = await admin.seedDevice(user.id, p.id, { reading_ts: new Date().toISOString(), last_seen_at: new Date().toISOString(), soil_pct: 45, battery_pct: 80 });
  await signIn(page, user);
  await openDetail(page, 'Menu fern');
  // Edit
  await clickVisible(page, 'More options');
  await clickVisible(page, 'Edit plant');
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Menu fern');
  await page.goBack();
  // Remove module, then Cancel keeps it
  await clickVisible(page, 'More options');
  await clickVisible(page, 'Remove module');
  await expect(page.getByText('Remove the module? Its history is deleted.', { exact: false })).toBeVisible();
  await clickVisible(page, 'Cancel');
  await expect(page.getByText('Remove the module?', { exact: false })).toHaveCount(0);
  expect(await rows(admin, `devices?select=id&id=eq.${d.id}`)).toHaveLength(1);
  // Remove for real
  await clickVisible(page, 'Remove module');
  await clickVisible(page, 'Remove');
  await expect(page.getByText("Setup isn't finished", { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add its module' })).toBeVisible();
  expect(await rows(admin, `devices?select=id&id=eq.${d.id}`)).toHaveLength(0);
});

test('E4 module card values, tank refill and a failed device load', async ({ page, user, admin }) => {
  const now = new Date().toISOString();
  const a = await admin.seedPlant(user.id, { name: 'Card fern' });
  await admin.seedDevice(user.id, a.id, { water_left_ml: 430, soil_pct: 40, battery_pct: 80, last_seen_at: now, reading_ts: now });
  const b = await admin.seedPlant(user.id, { name: 'Empty fern' });
  await admin.seedDevice(user.id, b.id, { float_low: true, last_seen_at: now, reading_ts: now });
  const c = await admin.seedPlant(user.id, { name: 'Unreachable fern' });
  await admin.seedDevice(user.id, c.id, { water_left_ml: 430, last_seen_at: now, reading_ts: now });
  await signIn(page, user);

  await openDetail(page, 'Card fern');
  await expect(page.getByText('About 450 ml left')).toBeVisible();
  await expect(page.getByText('Damp · 40 %')).toBeVisible();
  await expect(page.getByText('80 %', { exact: true })).toBeVisible();
  const time = await page.evaluate((iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), now);
  await expect(page.getByText(time, { exact: true })).toBeVisible();
  await page.goBack();

  await openDetail(page, 'Empty fern');
  await expect(page.getByText('Needs refilling', { exact: true })).toBeVisible();
  await expect(page.getByText('About 450 ml left')).toHaveCount(0);
  await page.goBack();

  let aborted = 0;
  await page.route('**/rest/v1/devices*', (r) => (r.request().method() === 'GET' ? (aborted++, r.fulfill({ status: 500, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: '{}' })) : r.continue()));
  await openDetail(page, 'Unreachable fern');
  await expect(page.getByText('Module', { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByText('—', { exact: true }).filter({ visible: true })).toHaveCount(4);
  expect(aborted).toBeGreaterThan(0);
  await expect(page.getByText('About 450 ml left')).toHaveCount(0);
});

test('E5 @pr fault then Resume watering', async ({ page, user, admin }) => {
  const now = new Date().toISOString();
  const p = await admin.seedPlant(user.id, { name: 'Stopped fern' });
  const d = await admin.seedDevice(user.id, p.id, { fault_code: 'no_moisture_rise', last_seen_at: now, reading_ts: now });
  await signIn(page, user);
  await openDetail(page, 'Stopped fern');
  await expect(page.getByText("Watering stopped. Check the stake is in the soil and the tube isn't kinked, then resume.")).toBeVisible();
  expect(await rows(admin, `device_commands?select=id&device_id=eq.${d.id}`)).toHaveLength(0);
  await clickVisible(page, 'Resume watering');
  await expect(page.getByText(/^Resumes at the next check-in/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Resume watering' })).toHaveCount(0);
  expect(await rows(admin, `device_commands?select=id&device_id=eq.${d.id}&acked_at=is.null`)).toHaveLength(1);
});

test('E6 about this plant shows when a species is set', async ({ page, user, admin }) => {
  await admin.seedPlant(user.id, { name: 'Known fern', speciesId: await fernId(admin) });
  await admin.seedPlant(user.id, { name: 'Plain fern' });
  await signIn(page, user);
  await openDetail(page, 'Known fern');
  await expect(page.getByRole('heading', { name: 'About this plant' })).toBeVisible();
  await expect(page.getByText('Medium light')).toBeVisible();
  await page.goBack();
  // Control: no species, no section.
  await openDetail(page, 'Plain fern');
  await expect(page.getByRole('heading', { name: 'Plain fern' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'About this plant' }).filter({ visible: true })).toHaveCount(0);
});
