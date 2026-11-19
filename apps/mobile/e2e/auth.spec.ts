import { randomUUID } from 'node:crypto';
import { expect, test, mailpitLink, signIn } from './support';
import type { Page } from '@playwright/test';

const PASSWORD = 'e2e-password-1';
const fresh = (domain = 'gmail.com', prefix = 'e2e') => `${prefix}-${randomUUID().slice(0, 8)}@${domain}`;
const mailCount = async (email: string) =>
  ((await (await fetch(`http://127.0.0.1:54324/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`)).json()) as { messages: unknown[] }).messages.length;

// Users made through the UI are unknown to the fixtures; find them by email and delete them.
const created: string[] = [];
test.afterEach(async ({ admin }) => {
  const r = await admin.rest('/auth/v1/admin/users?per_page=1000');
  const users = ((await r.json()) as { users: { id: string; email: string }[] }).users;
  for (const email of created.splice(0)) {
    const u = users.find((x) => x.email === email);
    if (u) await admin.deleteUser({ ...u, password: PASSWORD });
  }
});

async function fillAndSubmit(page: Page, email: string, password: string, button: string) {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: button }).click();
}

async function signUp(page: Page, email: string) {
  created.push(email);
  await page.goto('/sign-up');
  // The hook, MX lookup and SMTP round trip can outlast the default expect timeout: wait on the response first.
  const signup = page.waitForResponse((r) => r.url().includes('/auth/v1/signup'), { timeout: 15_000 });
  await fillAndSubmit(page, email, PASSWORD, 'Create account');
  expect((await signup).ok()).toBe(true);
  await expect(page.getByText(`We sent a confirmation link to ${email}. Confirm your email, then sign in.`)).toBeVisible();
}

test('B1 B5 @pr sign up, confirm by email, sign in', async ({ page }) => {
  const email = fresh();
  await signUp(page, email);
  await expect(page.getByLabel('Email')).toHaveValue(email);

  await page.goto(await mailpitLink(email));
  await expect(page.getByRole('heading', { name: 'Email confirmed' })).toBeVisible();
  await page.getByRole('link', { name: 'Sign in' }).click();
  await fillAndSubmit(page, email, PASSWORD, 'Sign in');
  await expect(page.getByText('Plants', { exact: true }).first()).toBeVisible();
});

test('B5 used link shows Link expired', async ({ page }) => {
  const email = fresh();
  await signUp(page, email);
  const link = await mailpitLink(email);
  await page.goto(link);
  await expect(page.getByRole('heading', { name: 'Email confirmed' })).toBeVisible(); // control: first use works
  await page.goto(link);
  await expect(page.getByRole('heading', { name: 'Link expired' })).toBeVisible();
});

test('B2 invalid input shows field errors and sends nothing', async ({ page }) => {
  const email = fresh();
  created.push(email);
  let signups = 0;
  page.on('request', (r) => r.url().includes('/auth/v1/signup') && signups++);
  await page.goto('/sign-up');

  await fillAndSubmit(page, '', PASSWORD, 'Create account');
  await expect(page.getByText('Enter your email.')).toBeVisible();
  await fillAndSubmit(page, 'bad', PASSWORD, 'Create account');
  await expect(page.getByText('Enter a valid email address.')).toBeVisible();
  await fillAndSubmit(page, email, '1234567', 'Create account');
  await expect(page.getByText('Password must be at least 8 characters.')).toBeVisible();
  expect(signups).toBe(0);
  expect(await mailCount(email)).toBe(0);

  // Control: the same address with valid input does send mail, so the checks above could have failed.
  await fillAndSubmit(page, email, PASSWORD, 'Create account');
  await mailpitLink(email);
  expect(signups).toBe(1);
});

test('B3 existing email', async ({ page, user }) => {
  await page.goto('/sign-up');
  await fillAndSubmit(page, user.email, PASSWORD, 'Create account');
  await expect(page.getByText('An account with this email already exists. Sign in instead.')).toBeVisible();
});

test('B4 disposable and no-mail domains are blocked', async ({ page }) => {
  const cases = [
    [fresh('mailinator.com', 'x'), "Use a permanent email address. Temporary inboxes can't be used."],
    [fresh('example.invalid', 'x'), "This email domain can't receive mail. Check the address."],
  ];
  await page.goto('/sign-up');
  for (const [email, message] of cases) {
    created.push(email);
    await fillAndSubmit(page, email, PASSWORD, 'Create account');
    await expect(page.getByText(message)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible(); // stayed on sign-up
  }
});

test('B6 sign in before confirming offers resend with cooldown', async ({ page, admin }) => {
  const email = fresh();
  created.push(email);
  const r = await admin.rest('/auth/v1/admin/users', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, email_confirm: false }),
  });
  expect(r.ok).toBe(true);

  await page.clock.install();
  await page.goto('/sign-in');
  await fillAndSubmit(page, email, PASSWORD, 'Sign in');
  await expect(page.getByText('Confirm your email first. Check your inbox, then sign in.')).toBeVisible();
  expect(await mailCount(email)).toBe(0);
  await page.getByRole('button', { name: 'Resend confirmation email' }).click();
  await expect(page.getByText(`Confirmation email sent to ${email}.`)).toBeVisible();
  await mailpitLink(email);
  await expect(page.getByRole('button', { name: /^Resend in \d+s$/ })).toBeDisabled();
  await page.clock.fastForward(60_000);
  await expect(page.getByRole('button', { name: 'Resend confirmation email' })).toBeEnabled();
});

test('B7 @pr wrong password and double tap', async ({ page, user }) => {
  await page.goto('/');
  await fillAndSubmit(page, user.email, 'wrong-password', 'Sign in');
  await expect(page.getByText('Email or password is incorrect.')).toBeVisible();

  let tokens = 0;
  page.on('request', (r) => r.url().includes('grant_type=password') && tokens++);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: 'Sign in' }).dblclick();
  await expect(page.getByText('Plants', { exact: true }).first()).toBeVisible();
  expect(tokens).toBe(1);
  await expect(page.getByText('Email or password is incorrect.')).toHaveCount(0);
});

test('B8 footer links switch screens without stacking', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sign in to Plant Care' })).toBeVisible();
  await page.getByText("Don't have an account? Sign up").click();
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await page.getByText('Already have an account? Sign in').click();
  await expect(page.getByRole('heading', { name: 'Sign in to Plant Care' })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL('about:blank'); // back left the app, no auth-screen loop
});

test('A4 expired session lands on sign in', async ({ page, user, admin }) => {
  await admin.seedPlant(user.id, { name: 'Cached Fern' });
  await signIn(page, user);
  await expect(page.getByText('Cached Fern')).toBeVisible();

  const token = await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: process.env.SUPABASE_ANON_KEY!, 'content-type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: user.password }),
  }).then(async (r) => ((await r.json()) as { access_token: string }).access_token);
  const out = await fetch(`${process.env.SUPABASE_URL}/auth/v1/logout?scope=global`, {
    method: 'POST',
    headers: { apikey: process.env.SUPABASE_ANON_KEY!, authorization: `Bearer ${token}` },
  });
  expect(out.ok).toBe(true);

  // The app trusts the JWT until it expires (1 h), so reload two hours later; the refresh then hits the revoked session.
  await page.clock.install({ time: new Date(Date.now() + 2 * 3600_000) });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByText('Cached Fern')).toHaveCount(0);
});

test('A7 opening sign in while signed in goes home', async ({ page, user }) => {
  await signIn(page, user);
  await page.goto('/sign-in');
  await expect(page.getByText('Plants', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toHaveCount(0);
});
