import { execFileSync } from 'node:child_process';
import { expect, test, signIn, clickVisible, FIXTURE_JPEG, type Admin, type TestUser } from './support';
import type { Page } from '@playwright/test';

const HEALTHY = 'It looks healthy in this photo.';
const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString();
const json = { 'content-type': 'application/json' };
// postgrest-js retries aborted GETs for ~7 s, so a failed load is simulated with a 500 (not retried).
const down = { status: 500, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: '{"message":"down"}' };

const dateLabel = (page: Page, iso: string) =>
  page.evaluate((d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }), iso);
const openDetail = async (page: Page, name: string) => {
  await page.getByRole('button', { name: new RegExp(`^${name},`) }).filter({ visible: true }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
};
const get = async <T>(admin: Admin, path: string) => (await (await admin.rest(`/rest/v1/${path}`)).json()) as T[];
const thumbLabels = (page: Page) =>
  page.getByRole('button', { name: /^Photo from/ }).filter({ visible: true }).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));

/** A health scan for the plant; `photoPath` also gets linked on the timeline (service_role can't update plant_photos, so via the DB container). */
async function seedHealth(admin: Admin, u: TestUser, plantId: string, health: object, photoPath?: string) {
  const r = await admin.rest('/rest/v1/scans?select=id', {
    method: 'POST',
    headers: { ...json, prefer: 'return=representation' },
    body: JSON.stringify({ user_id: u.id, plant_id: plantId, kind: 'health', status: 'ok', health, photo_paths: photoPath ? [photoPath] : [] }),
  });
  const [{ id }] = (await r.json()) as { id: string }[];
  if (photoPath) {
    execFileSync('docker', ['exec', '-i', 'supabase_db_plant-care', 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'], {
      input: `update public.plant_photos set scan_id = '${id}' where plant_id = '${plantId}' and path = '${photoPath}';`,
    });
  }
}
const chooseWhole = async (page: Page) => {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose from library' }).filter({ visible: true }).first().click();
  await (await chooser).setFiles(FIXTURE_JPEG);
};

test('G1 timeline strip and opening the viewer', async ({ page, user, admin }) => {
  const p = await admin.seedPlant(user.id, { name: 'Strip fern' });
  const dates = [daysAgo(5), daysAgo(3), daysAgo(1)]; // oldest first
  for (const d of dates) await admin.seedPhoto(user.id, p.id, d);
  await signIn(page, user);
  await openDetail(page, 'Strip fern');
  const newestFirst = await Promise.all([...dates].reverse().map(async (d) => `Photo from ${await dateLabel(page, d)}`));
  await expect.poll(() => thumbLabels(page)).toEqual(newestFirst);
  // See all opens at the newest photo.
  await page.getByRole('link', { name: 'See all' }).or(page.getByRole('button', { name: 'See all' })).filter({ visible: true }).click();
  await expect(page.getByText(await dateLabel(page, dates[2]), { exact: true })).toBeVisible();
  await expect(page.getByText(await dateLabel(page, dates[1]), { exact: true })).toHaveCount(0);
  // The second thumbnail opens at index 1.
  await page.goBack();
  await page.getByRole('button', { name: /^Photo from/ }).filter({ visible: true }).nth(1).click();
  await expect(page.getByText(await dateLabel(page, dates[1]), { exact: true })).toBeVisible();
  await expect(page.getByText(await dateLabel(page, dates[2]), { exact: true })).toHaveCount(0);
});

test('G2 add a photo from detail, then Not now', async ({ page, user, admin }) => {
  const p = await admin.seedPlant(user.id, { name: 'Snap fern' });
  await signIn(page, user);
  await openDetail(page, 'Snap fern');
  expect(await get<{ photo_path: string | null }>(admin, `plants?select=photo_path&id=eq.${p.id}`)).toEqual([{ photo_path: null }]);
  await clickVisible(page, 'Add a photo');
  const chooser = page.waitForEvent('filechooser');
  await clickVisible(page, 'Choose from library');
  await (await chooser).setFiles(FIXTURE_JPEG);
  await expect(page.getByText('Added to the timeline.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Not now' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Snap fern photo' })).toBeVisible(); // the new main photo
  const [row] = await get<{ photo_path: string }>(admin, `plants?select=photo_path&id=eq.${p.id}`);
  expect(await admin.listObjects(user.id)).toEqual([row.photo_path]);
  expect(await get(admin, `plant_photos?select=id&plant_id=eq.${p.id}`)).toHaveLength(1);
  expect(await get(admin, `scans?select=id&plant_id=eq.${p.id}`)).toHaveLength(0); // no check was started
  await clickVisible(page, 'Not now');
  await expect(page.getByText('Added to the timeline.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Not now' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add a photo' }).filter({ visible: true })).toBeVisible();
});

test('G3 viewer shows the date and a health result', async ({ page, user, admin }) => {
  const p = await admin.seedPlant(user.id, { name: 'View fern' });
  const older = daysAgo(4);
  const newer = daysAgo(2);
  await admin.seedPhoto(user.id, p.id, older);
  const checked = await admin.seedPhoto(user.id, p.id, newer);
  await seedHealth(admin, user, p.id, { healthy: false, note: 'Brown tips on two leaves.', advice: 'Mist it twice a week.' }, checked);
  await signIn(page, user);
  await page.goto(`/plant/${p.id}/photos`);
  await expect(page.getByText(await dateLabel(page, newer), { exact: true })).toBeVisible();
  await expect(page.getByText('Needs attention')).toBeVisible();
  await expect(page.getByText('Brown tips on two leaves.')).toBeVisible();
  await expect(page.getByText('Mist it twice a week.')).toBeVisible();
  // Control: the photo without a check shows no health text.
  await page.goto(`/plant/${p.id}/photos?start=1`);
  await expect(page.getByText(await dateLabel(page, older), { exact: true })).toBeVisible();
  await expect(page.getByText('Needs attention')).toHaveCount(0);
});

test('G3 start=25 with 30 photos loads the further page', async ({ page, user, admin }) => {
  test.setTimeout(180_000);
  const p = await admin.seedPlant(user.id, { name: 'Long fern' });
  const dates = Array.from({ length: 30 }, (_, i) => daysAgo(i + 1)); // newest first
  for (const d of [...dates].reverse()) await admin.seedPhoto(user.id, p.id, d);
  await signIn(page, user);
  await page.goto(`/plant/${p.id}/photos?start=25`);
  await expect(page.getByText(await dateLabel(page, dates[25]), { exact: true })).toBeVisible();
  // Control: the first page alone ends at index 19, so index 19's date is not what is shown.
  await expect(page.getByText(await dateLabel(page, dates[19]), { exact: true })).toHaveCount(0);
});

test('G3 a failed viewer load shows a dash', async ({ page, user, admin }) => {
  const p = await admin.seedPlant(user.id, { name: 'Down fern' });
  await admin.seedPhoto(user.id, p.id, daysAgo(1));
  await signIn(page, user);
  let failed = 0;
  await page.route('**/rest/v1/plant_photos*', (r) => (r.request().method() === 'GET' ? (failed++, r.fulfill(down)) : r.continue()));
  await page.goto(`/plant/${p.id}/photos`);
  await expect(page.getByText('—', { exact: true })).toBeVisible();
  expect(failed).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: 'What is it?' })).toHaveCount(0);
});

test('G5 what is it: pick a suggestion sets the plant type', async ({ page, user, admin }) => {
  const p = await admin.seedPlant(user.id, { name: 'Guess fern', withPhoto: true });
  await signIn(page, user);
  await page.goto(`/plant/${p.id}/photos`);
  expect(await get<{ species_id: string | null }>(admin, `plants?select=species_id&id=eq.${p.id}`)).toEqual([{ species_id: null }]);
  await clickVisible(page, 'What is it?');
  await expect(page.getByText('Is it one of these?')).toBeVisible();
  await page.getByRole('button', { name: 'Peacock plant, Calathea makoyana, Very likely' }).click();
  await expect(page.getByText('Plant type updated.')).toBeVisible();
  const [{ species_id }] = await get<{ species_id: string | null }>(admin, `plants?select=species_id&id=eq.${p.id}`);
  expect(species_id).not.toBeNull();
  expect(await get(admin, `species?select=scientific_name&id=eq.${species_id}`)).toEqual([{ scientific_name: 'Calathea makoyana' }]);
  // Plant.id was used for the user's own identify scan, which is then linked to the plant.
  await expect.poll(async () => (await get(admin, `scans?select=id&user_id=eq.${user.id}&kind=eq.identify&plant_id=eq.${p.id}`)).length).toBe(1);
});

test('G6 @pr health check from detail', async ({ page, user, admin }) => {
  const p = await admin.seedPlant(user.id, { name: 'Check fern' });
  await signIn(page, user);
  await openDetail(page, 'Check fern');
  await page.getByRole('button', { name: 'Check its health' }).filter({ visible: true }).click();
  const check = page.getByRole('button', { name: 'Check', exact: true }).filter({ visible: true });
  await expect(check).toBeDisabled(); // no whole-plant photo yet
  await chooseWhole(page);
  await expect(page.getByRole('img', { name: 'Whole plant photo' })).toBeVisible();
  await expect(check).toBeEnabled();
  await check.click();
  await expect(page.getByRole('heading', { name: HEALTHY })).toBeVisible();
  await clickVisible(page, 'Done');
  await expect(page.getByRole('heading', { name: 'Check fern' })).toBeVisible();
  await expect(page.getByText(HEALTHY).filter({ visible: true })).toBeVisible(); // the health card now shows the result
  await expect(page.getByText('Not checked yet.')).toHaveCount(0);
  expect(await get(admin, `scans?select=id&plant_id=eq.${p.id}&kind=eq.health&status=eq.ok`)).toHaveLength(1);
  expect(await get<{ scan_id: string | null }>(admin, `plant_photos?select=scan_id&plant_id=eq.${p.id}`)).toEqual([{ scan_id: expect.any(String) }]);
});

test('G6 leaving before checking deletes the uploaded photos', async ({ page, user, admin }) => {
  const p = await admin.seedPlant(user.id, { name: 'Leave fern', withPhoto: true });
  const seeded = await admin.listObjects(user.id);
  expect(seeded).toHaveLength(1);
  await signIn(page, user);
  await openDetail(page, 'Leave fern');
  await page.getByRole('button', { name: 'Check its health' }).filter({ visible: true }).click();
  await chooseWhole(page);
  await expect(page.getByRole('img', { name: 'Whole plant photo' })).toBeVisible();
  await expect.poll(() => admin.listObjects(user.id)).toHaveLength(seeded.length + 1); // it really was uploaded
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Leave fern' })).toBeVisible();
  await expect.poll(() => admin.listObjects(user.id)).toEqual(seeded);
  expect(await get(admin, `scans?select=id&plant_id=eq.${p.id}`)).toHaveLength(0);
});

test('G7 health card: not checked yet, then a seeded result', async ({ page, user, admin }) => {
  await admin.seedPlant(user.id, { name: 'Fresh fern' });
  const b = await admin.seedPlant(user.id, { name: 'Seen fern' });
  await seedHealth(admin, user, b.id, { healthy: true, note: 'Glossy leaves, no spots.', advice: null });
  await signIn(page, user);
  await openDetail(page, 'Fresh fern');
  await expect(page.getByText('Not checked yet.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Check its health' }).filter({ visible: true })).toBeVisible();
  await expect(page.getByText(/^Checked /)).toHaveCount(0);
  await page.goBack();
  await openDetail(page, 'Seen fern');
  await expect(page.getByText('Glossy leaves, no spots.')).toBeVisible();
  await expect(page.getByText(/^Checked /)).toBeVisible();
  await expect(page.getByText('Not checked yet.').filter({ visible: true })).toHaveCount(0);
});
