import { expect, test, signIn, clickVisible, startAdd, addPhoto } from './support';
import type { Page } from '@playwright/test';

const FAKE = 'http://127.0.0.1:8787';
const scenario = (s: object) => fetch(`${FAKE}/__scenario`, { method: 'POST', body: JSON.stringify(s) });
test.afterEach(async () => void (await fetch(`${FAKE}/__reset`, { method: 'POST' })));

const identifyStep = async (page: Page) => {
  await clickVisible(page, 'Continue');
  await expect(page.getByRole('heading', { name: 'What kind of plant is it?' })).toBeVisible();
};

test('D5 not a plant', async ({ page, user, admin }) => {
  expect((await scenario({ identify: 'not_plant' })).ok).toBe(true);
  await signIn(page, user);
  await startAdd(page);
  await identifyStep(page);
  await page.getByRole('button', { name: 'Identify from my photo' }).click();
  await expect(page.getByText("Couldn't tell from this photo. Try one with a whole leaf in view, or search.")).toBeVisible();
  await expect(page.getByText(/^It's a /)).toHaveCount(0);
  const scans = await (await admin.rest(`/rest/v1/scans?select=status&kind=eq.identify&user_id=eq.${user.id}`)).json();
  expect(scans).toEqual([{ status: 'not_plant' }]); // the fake really answered not_plant
});

test('D5 low confidence shows choices', async ({ page, user }) => {
  expect((await scenario({ identify: 'low' })).ok).toBe(true);
  await signIn(page, user);
  await startAdd(page);
  await identifyStep(page);
  await page.getByRole('button', { name: 'Identify from my photo' }).click();
  await expect(page.getByRole('heading', { name: 'Is it one of these?' })).toBeVisible();
  await expect(page.getByText(/^It's a /)).toHaveCount(0); // nothing auto-applied
  const picks = page.getByRole('button', { name: /^[^,]+, [^,]+, (Very likely|Likely|Possibly)$/ });
  expect(await picks.count()).toBeLessThanOrEqual(3);
  await picks.first().click();
  await expect(page.getByText("It's a Peacock plant.")).toBeVisible();
});

test('D11 failed check offers Try again', async ({ page, user, admin }) => {
  expect((await scenario({ health: 'error' })).ok).toBe(true);
  await signIn(page, user);
  await startAdd(page);
  await addPhoto(page, 3, 'Problem spot');
  await identifyStep(page);
  await clickVisible(page, 'Continue');
  await page.getByLabel('Name', { exact: true }).fill('Unlucky');
  await clickVisible(page, 'Continue');
  await expect(page.getByText("Couldn't check right now.")).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  expect(await admin.listObjects(user.id)).toHaveLength(2); // control: the problem photo is still stored
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await expect(page.getByRole('heading', { name: 'Unlucky' })).toBeVisible();
  const [plant] = await (await admin.rest(`/rest/v1/plants?select=photo_path&user_id=eq.${user.id}`)).json();
  await expect.poll(() => admin.listObjects(user.id)).toEqual([plant.photo_path]);
});
