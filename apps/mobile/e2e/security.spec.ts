import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test, signIn, clickVisible, hasExifGps, FIXTURE_JPEG, type TestUser } from './support';
import type { Page } from '@playwright/test';

const photoCard = async (page: Page, n: number) => {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose from library' }).filter({ visible: true }).nth(n).click();
  await (await chooser).setFiles(FIXTURE_JPEG);
};

/** From Plants: open the add flow and upload the whole-plant photo (step 1). */
async function startAdd(page: Page) {
  await page.getByRole('button', { name: 'Add a pot' }).first().click();
  await photoCard(page, 0);
  await expect(page.getByRole('button', { name: 'Remove' })).toBeVisible();
}

const accessToken = async (u: TestUser) => {
  const r = await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: process.env.SUPABASE_ANON_KEY!, 'content-type': 'application/json' },
    body: JSON.stringify({ email: u.email, password: u.password }),
  });
  return ((await r.json()) as { access_token: string }).access_token;
};

test('D4 @pr upload is JPEG without GPS', async ({ page, user, admin }) => {
  expect(hasExifGps(readFileSync(FIXTURE_JPEG))).toBe(true); // the fixture really carries GPS
  await signIn(page, user);
  await startAdd(page);
  const stored = await admin.listObjects(user.id);
  expect(stored).toHaveLength(1);
  const bytes = Buffer.from(await (await admin.rest(`/storage/v1/object/plant-photos/${stored[0]}`)).arrayBuffer());
  expect([bytes[0], bytes[1]]).toEqual([0xff, 0xd8]);
  expect(hasExifGps(bytes)).toBe(false);
});

test('D4 @pr bucket rejects PNG and over 3 MB', async ({ user }) => {
  const token = await accessToken(user);
  const upload = (type: string, body: Uint8Array<ArrayBuffer>) =>
    fetch(`${process.env.SUPABASE_URL}/storage/v1/object/plant-photos/${user.id}/${randomUUID()}.jpg`, {
      method: 'POST',
      headers: { apikey: process.env.SUPABASE_ANON_KEY!, authorization: `Bearer ${token}`, 'content-type': type },
      body,
    });
  expect((await upload('image/jpeg', new Uint8Array(readFileSync(FIXTURE_JPEG)))).ok).toBe(true); // control
  expect((await upload('image/png', Buffer.from('89504e470d0a1a0a', 'hex'))).ok).toBe(false);
  expect((await upload('image/jpeg', Buffer.alloc(3 * 1024 * 1024 + 1, 1))).ok).toBe(false);
});

test('H2 @pr deleting a plant leaves no photos, scans or timeline rows', async ({ page, user, admin }) => {
  const plant = await admin.seedPlant(user.id, { name: 'E2E Fern', withPhoto: true });
  const scanPaths = [await admin.seedPhoto(user.id, plant.id), await admin.seedPhoto(user.id, plant.id)];
  const scan = (kind: string, path: string) => ({ user_id: user.id, plant_id: plant.id, kind, status: 'ok', photo_paths: [path] });
  const r = await admin.rest('/rest/v1/scans', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify([scan('health', scanPaths[0]), scan('identify', scanPaths[1])]),
  });
  expect(r.ok).toBe(true);
  expect(await admin.listObjects(user.id)).toHaveLength(3);

  await signIn(page, user);
  await page.getByText('E2E Fern').click();
  await page.getByRole('button', { name: 'More options' }).click();
  await page.getByRole('button', { name: 'Edit plant' }).click();
  await page.getByRole('button', { name: 'Delete plant' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByText('No plants yet')).toBeVisible();
  await expect.poll(() => admin.listObjects(user.id)).toEqual([]);
  expect(await (await admin.rest(`/rest/v1/scans?select=id&user_id=eq.${user.id}`)).json()).toEqual([]);
  expect(await (await admin.rest(`/rest/v1/plant_photos?select=id&user_id=eq.${user.id}`)).json()).toEqual([]);
});

test('D9 @pr cancel at each step deletes uploaded photos', async ({ page, user, admin }) => {
  await signIn(page, user);
  for (const step of [1, 2, 3]) {
    await page.goto('/');
    await expect(page.getByText('No plants yet')).toBeVisible();
    await startAdd(page);
    if (step >= 2) {
      await clickVisible(page, 'Continue');
      await expect(page.getByRole('heading', { name: 'What kind of plant is it?' })).toBeVisible();
    }
    if (step === 3) {
      await clickVisible(page, 'Continue');
      await expect(page.getByLabel('Name', { exact: true })).toBeVisible();
    }
    expect(await admin.listObjects(user.id)).toHaveLength(1);
    await clickVisible(page, 'Cancel');
    await expect.poll(() => admin.listObjects(user.id), { message: `step ${step}` }).toEqual([]);
    expect(await (await admin.rest(`/rest/v1/plants?select=id&user_id=eq.${user.id}`)).json()).toEqual([]);
  }
});

test('D10 leaf photo is deleted after save when identify was not used', async ({ page, user, admin }) => {
  await signIn(page, user);
  await startAdd(page);
  await photoCard(page, 1); // leaf card
  await expect(page.getByRole('img', { name: 'One leaf photo' })).toBeVisible();
  await expect.poll(() => admin.listObjects(user.id)).toHaveLength(2);
  await clickVisible(page, 'Continue');
  await expect(page.getByRole('heading', { name: 'What kind of plant is it?' })).toBeVisible();
  await clickVisible(page, 'Continue'); // no identify
  await page.getByLabel('Name', { exact: true }).fill('Leafless');
  await clickVisible(page, 'Continue');
  await page.getByRole('button', { name: 'Skip for now' }).click();
  const [plant] = await (await admin.rest(`/rest/v1/plants?select=photo_path&user_id=eq.${user.id}`)).json();
  await expect.poll(() => admin.listObjects(user.id)).toEqual([plant.photo_path]);
});

test('G4 @pr deleting a photo removes it and promotes the next newest', async ({ page, user, admin }) => {
  const plant = await admin.seedPlant(user.id, { name: 'Photo Fern', withPhoto: true });
  const older = plant.photoPath!;
  await admin.seedPhoto(user.id, plant.id, new Date(Date.now() + 3600_000).toISOString());
  const photoPath = async () => (await (await admin.rest(`/rest/v1/plants?select=photo_path&id=eq.${plant.id}`)).json())[0].photo_path;
  const del = async () => {
    await page.getByRole('button', { name: 'Delete photo' }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
  };

  await signIn(page, user);
  await page.getByText('Photo Fern').click();
  await page.getByRole('button', { name: 'See all' }).click();
  await del(); // opens on the newest
  await expect.poll(() => admin.listObjects(user.id)).toEqual([older]);
  await expect.poll(photoPath).toBe(older);

  await del(); // last one: the viewer closes
  await expect(page.getByRole('button', { name: 'Delete photo' })).toBeHidden();
  await expect.poll(() => admin.listObjects(user.id)).toEqual([]);
});

test("E2 @pr another user's plant shows nothing", async ({ page, user, admin }) => {
  const other = await admin.createUser();
  const plant = await admin.seedPlant(other.id, { name: 'Secret Fern B' });
  await signIn(page, user);
  await page.goto(`/plant/${plant.id}`);
  await expect(page.getByRole('heading', { name: '—' })).toBeVisible();
  await expect(page.getByText('Secret Fern B')).toHaveCount(0);
});

test('A6 @pr signed-out deep links redirect to sign in', async ({ page }) => {
  for (const path of [`/plant/${randomUUID()}`, '/settings']) {
    await page.goto(path);
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  }
});

test('B9 @pr sign-out clears the cache', async ({ page, user, admin }) => {
  const b = await admin.createUser();
  await admin.seedPlant(user.id, { name: 'Fern A' });
  await signIn(page, user);
  await expect(page.getByText('Fern A')).toBeVisible();
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await signIn(page, b);
  await expect(page.getByText('No plants yet')).toBeVisible();
  await expect(page.getByText('Fern A')).toHaveCount(0);
  await page.goBack();
  await expect(page.getByText('Fern A')).toHaveCount(0);
});
