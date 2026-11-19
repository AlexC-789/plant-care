import { expect, test, signIn, clickVisible, down, type Admin } from './support';
import type { Page } from '@playwright/test';

const FERN = 'Adiantum raddianum'; // Maidenhair fern, from the seeded species table

const plantRow = async (admin: Admin, id: string) =>
  ((await (await admin.rest(`/rest/v1/plants?select=name,room,species_id&id=eq.${id}`)).json()) as { name: string; room: string | null; species_id: string | null }[])[0];
const openEdit = async (page: Page, name: string) => {
  await page.getByRole('button', { name: new RegExp(`^${name},`) }).filter({ visible: true }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
  await clickVisible(page, 'More options');
  await clickVisible(page, 'Edit plant');
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue(name);
};

test('H1 edit: rename, change type by search, set room', async ({ page, user, admin }) => {
  const p = await admin.seedPlant(user.id, { name: 'Old name' });
  await signIn(page, user);
  await openEdit(page, 'Old name');
  await page.getByLabel('Name', { exact: true }).fill('New name');
  await page.getByRole('button', { name: /^Plant type/ }).click();
  await page.getByLabel('Search plants').fill('Maidenhair');
  await page.getByRole('button', { name: `Maidenhair fern — ${FERN}` }).click();
  await expect(page.getByRole('button', { name: 'Plant type' }).getByText('Maidenhair fern')).toBeVisible();
  await page.getByLabel('Room').fill('Kitchen');
  expect(await plantRow(admin, p.id)).toEqual({ name: 'Old name', room: null, species_id: null }); // nothing saved before Done
  await clickVisible(page, 'Done');
  await expect(page.getByRole('heading', { name: 'New name' })).toBeVisible();
  await expect(page.getByText('Maidenhair fern · Kitchen')).toBeVisible();
  const saved = await plantRow(admin, p.id);
  expect(saved).toEqual({ name: 'New name', room: 'Kitchen', species_id: expect.any(String) });
  const sp = await (await admin.rest(`/rest/v1/species?select=scientific_name&id=eq.${saved.species_id}`)).json();
  expect(sp).toEqual([{ scientific_name: FERN }]);
});

test('H1 empty name is refused', async ({ page, user, admin }) => {
  const p = await admin.seedPlant(user.id, { name: 'Keep name' });
  await signIn(page, user);
  await openEdit(page, 'Keep name');
  await expect(page.getByText('Give it a name (up to 60 characters).')).toHaveCount(0);
  await page.getByLabel('Name', { exact: true }).fill('   ');
  await clickVisible(page, 'Done');
  await expect(page.getByText('Give it a name (up to 60 characters).')).toBeVisible();
  expect((await plantRow(admin, p.id)).name).toBe('Keep name');
  // Control: a real name saves.
  await page.getByLabel('Name', { exact: true }).fill('Fixed name');
  await clickVisible(page, 'Done');
  await expect(page.getByRole('heading', { name: 'Fixed name' })).toBeVisible();
  expect((await plantRow(admin, p.id)).name).toBe('Fixed name');
});

test('H1 a failed save shows the error and keeps the plant', async ({ page, user, admin }) => {
  const p = await admin.seedPlant(user.id, { name: 'Stay name' });
  await signIn(page, user);
  await openEdit(page, 'Stay name');
  let failed = 0;
  await page.route('**/rest/v1/plants*', (r) => (r.request().method() === 'PATCH' ? (failed++, r.fulfill(down)) : r.continue()));
  await page.getByLabel('Name', { exact: true }).fill('Lost name');
  await clickVisible(page, 'Done');
  await expect(page.getByText("Couldn't save that. Try again.")).toBeVisible();
  expect(failed).toBeGreaterThan(0);
  expect((await plantRow(admin, p.id)).name).toBe('Stay name');
  // Control: once the server is back, the same Done saves.
  await page.unroute('**/rest/v1/plants*');
  await clickVisible(page, 'Done');
  await expect(page.getByRole('heading', { name: 'Lost name' })).toBeVisible();
  expect((await plantRow(admin, p.id)).name).toBe('Lost name');
});
