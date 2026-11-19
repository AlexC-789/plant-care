import { expect, test, signIn, clickVisible, FIXTURE_JPEG, type TestUser, type Admin } from './support';
import type { Page } from '@playwright/test';

const FAKE = 'http://127.0.0.1:8787';
const callCount = async () => ((await (await fetch(`${FAKE}/__calls`)).json()) as { calls: number }).calls;
const LIMIT = "You've reached the identification limit for now. Search for the plant type, or try again later.";
const HEALTHY = 'It looks healthy in this photo.';

const photoCard = async (page: Page, n: number) => {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose from library' }).filter({ visible: true }).nth(n).click();
  await (await chooser).setFiles(FIXTURE_JPEG);
};
// Card order: 0 whole, 1 leaf, 2 flower, 3 problem. Waits for the upload (the card's photo) before returning.
const addPhoto = async (page: Page, n: number, title: string) => {
  await photoCard(page, n);
  await expect(page.getByRole('img', { name: `${title} photo` })).toBeVisible();
};
const identifyStep = async (page: Page) => {
  await clickVisible(page, 'Continue');
  await expect(page.getByRole('heading', { name: 'What kind of plant is it?' })).toBeVisible();
};
const startAdd = async (page: Page) => {
  await page.getByRole('button', { name: 'Add a pot' }).first().click();
  await addPhoto(page, 0, 'Whole plant');
};
/** On the identify step with no type: Continue to Where and fill the required Name. */
const nameIt = async (page: Page, name: string) => {
  await clickVisible(page, 'Continue');
  await page.getByLabel('Name', { exact: true }).fill(name);
};
const plantRows = async (admin: Admin, u: TestUser) => (await (await admin.rest(`/rest/v1/plants?select=id,name&user_id=eq.${u.id}`)).json()) as { name: string }[];

test('D1 @pr happy path', async ({ page, user, admin }) => {
  await signIn(page, user);
  await startAdd(page);
  await identifyStep(page);
  await page.getByRole('button', { name: 'Identify from my photo' }).click();
  await expect(page.getByText("It's a Peacock plant.")).toBeVisible();
  await clickVisible(page, 'Continue');
  await page.getByLabel('Room').fill('Living room');
  await page.getByLabel('Nickname').fill('Stripes');
  await clickVisible(page, 'Continue');
  await page.getByRole('button', { name: 'Check its health now' }).click();
  await expect(page.getByText(HEALTHY)).toBeVisible();
  await page.getByTestId('bottom-bar').getByRole('button', { name: 'Done' }).filter({ visible: true }).click(); // the header also has a Done
  await expect(page.getByRole('heading', { name: 'Stripes' })).toBeVisible();
  expect(await plantRows(admin, user)).toEqual([expect.objectContaining({ name: 'Stripes' })]);
  await page.goto('/');
  await expect(page.getByText('Stripes')).toBeVisible();
});

test('D2 photo step rules', async ({ page, user }) => {
  await signIn(page, user);
  await page.getByRole('button', { name: 'Add a pot' }).first().click();
  const next = page.getByRole('button', { name: 'Continue' });
  await expect(next).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Remove' })).toHaveCount(0);
  await addPhoto(page, 0, 'Whole plant');
  await expect(next).toBeEnabled();
  // Optional card: add, then Remove it.
  await addPhoto(page, 1, 'One leaf');
  await expect(page.getByRole('button', { name: 'Remove' })).toHaveCount(2);
  await page.getByRole('button', { name: 'Remove' }).nth(1).click();
  await expect(page.getByRole('img', { name: 'One leaf photo' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Remove' })).toHaveCount(1);
  // Skip the (now empty) leaf card, which is the first Skip; Add photo brings it back.
  await expect(page.getByRole('button', { name: 'Skip' })).toHaveCount(3);
  await page.getByRole('button', { name: 'Skip' }).first().click();
  await expect(page.getByRole('button', { name: 'Skip' })).toHaveCount(2);
  await page.getByRole('button', { name: 'Add photo' }).click();
  await expect(page.getByRole('button', { name: 'Skip' })).toHaveCount(3);
  await expect(next).toBeEnabled();
});

test('D5 @pr identify limit', async ({ page, user, admin }) => {
  await admin.seedScans(user.id, 20);
  const before = await callCount();
  await signIn(page, user);
  await startAdd(page);
  await identifyStep(page);
  await page.getByRole('button', { name: 'Identify from my photo' }).click();
  await expect(page.getByText(LIMIT)).toBeVisible();
  expect(await callCount()).toBe(before); // refused before any Plant.id call
  const scans = await (await admin.rest(`/rest/v1/scans?select=id&user_id=eq.${user.id}`)).json();
  expect(scans).toHaveLength(20);
});

test('D6 search and custom type', async ({ page, user }) => {
  await signIn(page, user);
  await startAdd(page);
  await identifyStep(page);
  await page.getByRole('button', { name: 'I know it — search' }).click();
  await page.getByLabel('Search plants').fill('Peacock');
  await page.getByText(/Peacock plant — Calathea makoyana/).first().click();
  await expect(page.getByText("It's a Peacock plant.")).toBeVisible();

  // The fake's name search answers every query, so make the name search fail: no hits means the custom row.
  await page.route('**/functions/v1/search-plants', (r) => r.abort());
  await page.getByRole('button', { name: 'I know it — search' }).click();
  await page.getByLabel('Search plants').fill('Mystery fern');
  await page.getByText('Use “Mystery fern” as the type').click();
  await expect(page.getByText("It's a Mystery fern.")).toBeVisible();
});

test('D7 skip type requires a name', async ({ page, user }) => {
  await signIn(page, user);
  await startAdd(page);
  await identifyStep(page);
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await expect(page.getByText('Not sure? You can set it later.')).toBeVisible();
  await clickVisible(page, 'Continue');
  const name = page.getByLabel('Name', { exact: true });
  await expect(name).toBeVisible();
  const next = page.getByRole('button', { name: 'Continue', exact: true }).filter({ visible: true });
  await expect(next).toBeDisabled();
  await name.fill('Fernie');
  await expect(next).toBeEnabled();
});

test('D8 @pr double tap saves one plant', async ({ page, user, admin }) => {
  await signIn(page, user);
  await startAdd(page);
  await identifyStep(page);
  await nameIt(page, 'Twice');
  await page.getByRole('button', { name: 'Continue', exact: true }).filter({ visible: true }).dblclick();
  await expect(page.getByText('Twice is saved.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Want a quick health check for Twice?' })).toBeVisible();
  expect(await plantRows(admin, user)).toHaveLength(1);
});

test('D8 @pr save failure shows the error and retry saves', async ({ page, user, admin }) => {
  await signIn(page, user);
  await startAdd(page);
  await identifyStep(page);
  await nameIt(page, 'Retry');
  await page.route('**/rest/v1/plants*', (r) => r.abort(), { times: 1 });
  await clickVisible(page, 'Continue');
  await expect(page.getByText("Couldn't save your plant. Try again.")).toBeVisible();
  expect(await plantRows(admin, user)).toEqual([]);
  await clickVisible(page, 'Continue');
  await expect(page.getByText('Retry is saved.')).toBeVisible();
  expect(await plantRows(admin, user)).toHaveLength(1);
});

test('D11 @pr problem photo starts the check; Done keeps the plant', async ({ page, user, admin }) => {
  await signIn(page, user);
  await startAdd(page);
  await addPhoto(page, 3, 'Problem spot');
  await identifyStep(page);
  await nameIt(page, 'Spotty');
  await clickVisible(page, 'Continue');
  // No "Check its health now": the check starts by itself.
  await expect(page.getByText(HEALTHY)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Check its health now' })).toHaveCount(0);
  const checks = await (await admin.rest(`/rest/v1/scans?select=id&kind=eq.health&user_id=eq.${user.id}`)).json();
  expect(checks).toHaveLength(1);
  await page.getByTestId('bottom-bar').getByRole('button', { name: 'Done' }).filter({ visible: true }).click(); // the header also has a Done
  await expect(page.getByRole('heading', { name: 'Spotty' })).toBeVisible();
  expect(await plantRows(admin, user)).toHaveLength(1);
  expect(await admin.listObjects(user.id)).toHaveLength(2); // whole + problem photo kept
});

test('D12 @pr going back after save never makes a second plant', async ({ page, user, admin }) => {
  await signIn(page, user);
  await startAdd(page);
  await identifyStep(page);
  await nameIt(page, 'Once');
  await clickVisible(page, 'Continue');
  const offer = page.getByRole('heading', { name: 'Want a quick health check for Once?' });
  await expect(offer).toBeVisible();
  expect(await plantRows(admin, user)).toHaveLength(1);
  await page.goBack();
  await page.goBack();
  await expect(page).toHaveURL(/\/add\/health$/);
  await expect(offer).toBeVisible();
  expect(await plantRows(admin, user)).toHaveLength(1);
});
