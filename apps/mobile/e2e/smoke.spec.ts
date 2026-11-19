import { expect, test, signIn, clickVisible, FIXTURE_JPEG, type TestUser } from './support';

const FAKE = 'http://127.0.0.1:8787';
const callCount = async () => ((await (await fetch(`${FAKE}/__calls`)).json()) as { calls: number }).calls;

test('A2 @pr signed-in cold start shows Plants', async ({ page, user }) => {
  await signIn(page, user);
  await expect(page.getByText('Plants', { exact: true }).first()).toBeVisible();
});

test('D5 @pr identify goes through the fake Plant.id', async ({ page, user, admin }) => {
  const before = await callCount();
  await signIn(page, user);
  await page.getByRole('button', { name: 'Add a pot' }).first().click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose from library' }).first().click();
  await (await chooser).setFiles(FIXTURE_JPEG);
  await page.getByRole('button', { name: 'Remove' }).waitFor();
  await clickVisible(page, 'Continue');
  await page.getByRole('button', { name: 'Identify from my photo' }).click();
  await expect(page.getByText("It's a Peacock plant.")).toBeVisible();
  const scans = await (await admin.rest(`/rest/v1/scans?user_id=eq.${user.id}&kind=eq.identify`)).json();
  expect(scans).toHaveLength(1);
  expect(await callCount()).toBeGreaterThan(before); // the running stack uses the fake, not real Plant.id
});

test.describe.serial('infra user fixture cleans up', () => {
  let made: TestUser;
  test('infra fixture user with an object', async ({ user, admin }) => {
    made = user;
    await admin.seedPhoto(user.id, (await admin.seedPlant(user.id, { name: 'Cleanup fern' })).id);
    expect(await admin.listObjects(user.id)).toHaveLength(1);
  });
  test('infra previous fixture user is gone with its objects', async ({ admin }) => {
    expect((await admin.rest(`/auth/v1/admin/users/${made.id}`)).status).toBe(404);
    expect(await admin.listObjects(made.id)).toEqual([]);
  });
});

test('infra 40 sign-ins in a row succeed', async ({ user }) => {
  const key = process.env.SUPABASE_ANON_KEY!;
  for (let i = 0; i < 40; i++) {
    const r = await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: key, 'content-type': 'application/json' },
      body: JSON.stringify({ email: user.email, password: user.password }),
    });
    expect(r.status).toBe(200);
  }
});
