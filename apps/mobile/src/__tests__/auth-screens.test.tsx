import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { supabase } from '@/lib/supabase';
import { emitAuthEvent, fakeSession } from '@/test-utils/supabaseMock';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories must be self-contained
jest.mock('@/lib/supabase', () => require('@/test-utils/supabaseMock'));

const auth = supabase.auth as unknown as Record<string, jest.Mock>;
const NETWORK = "Can't reach the server. Check your connection and try again.";

beforeEach(() => {
  jest.clearAllMocks();
  auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
});

async function openApp(url = '/') {
  const view = await renderRouter('src/app', { initialUrl: url });
  await waitFor(() => expect(screen.queryByTestId('auth-loading')).toBeNull());
  return view;
}

async function fill(email: string, password: string) {
  await fireEvent.changeText(screen.getByLabelText('Email'), email);
  await fireEvent.changeText(screen.getByLabelText('Password'), password);
}

describe('routing', () => {
  test('shows a loading indicator while the session is read', async () => {
    auth.getSession.mockReturnValue(new Promise(() => {}));
    await renderRouter('src/app', { initialUrl: '/' });
    expect(screen.getByTestId('auth-loading')).toBeTruthy();
  });

  test('signed out users land on sign-in', async () => {
    const view = await openApp('/');
    await waitFor(() => expect(view.getPathname()).toBe('/sign-in'));
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
  });

  test('signed in users land on the empty library', async () => {
    auth.getSession.mockResolvedValue({ data: { session: fakeSession }, error: null });
    const view = await openApp('/');
    expect(view.getPathname()).toBe('/');
    expect(screen.getByText('No plants yet')).toBeTruthy();
    expect(screen.getByText('Scan your first plant to get started.')).toBeTruthy();
  });

  test('signing in moves to the library', async () => {
    await openApp('/sign-in');
    await act(async () => emitAuthEvent('SIGNED_IN', fakeSession));
    await waitFor(() => expect(screen.getByText('No plants yet')).toBeTruthy());
  });

  test('signed in users opening sign-in are sent to the library', async () => {
    auth.getSession.mockResolvedValue({ data: { session: fakeSession }, error: null });
    const view = await openApp('/sign-in');
    await waitFor(() => expect(view.getPathname()).toBe('/'));
  });

  test('signing out from the library returns to sign-in', async () => {
    auth.getSession.mockResolvedValue({ data: { session: fakeSession }, error: null });
    const view = await openApp('/');
    await act(async () => emitAuthEvent('SIGNED_OUT', null));
    await waitFor(() => expect(view.getPathname()).toBe('/sign-in'));
  });
});

describe('sign-in', () => {
  test('invalid input shows messages and does not call the server', async () => {
    await openApp('/sign-in');
    await fill('nope', '123');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('Enter a valid email address.')).toBeTruthy();
    expect(screen.getByText('Password must be at least 8 characters.')).toBeTruthy();
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  test('double tap sends one request and the button is disabled while pending', async () => {
    let resolve!: (v: unknown) => void;
    auth.signInWithPassword.mockReturnValue(new Promise((r) => (resolve = r)));
    await openApp('/sign-in');
    await fill(' a@example.com ', 'password123');
    const button = screen.getByRole('button', { name: 'Sign in' });
    await fireEvent.press(button);
    await fireEvent.press(button);
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'a@example.com',
      password: 'password123',
    });
    await act(async () => resolve({ data: { session: null, user: null }, error: null }));
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  test('network failure shows a message and re-enables the button', async () => {
    auth.signInWithPassword.mockRejectedValue(new TypeError('Network request failed'));
    await openApp('/sign-in');
    await fill('a@example.com', 'password123');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(screen.getByText(NETWORK)).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  test('wrong password shows the server message', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { code: 'invalid_credentials' },
    });
    await openApp('/sign-in');
    await fill('a@example.com', 'password123');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(screen.getByText('Email or password is incorrect.')).toBeTruthy());
  });

  test('opened directly, shows no notice and an empty email', async () => {
    await openApp('/sign-in');
    expect(screen.getByLabelText('Email')).toHaveDisplayValue('');
    expect(screen.queryByText(/We sent a confirmation link/)).toBeNull();
    expect(screen.queryByText('Account created. Sign in to continue.')).toBeNull();
  });

  test('links to sign-up', async () => {
    const view = await openApp('/sign-in');
    await fireEvent.press(screen.getByText("Don't have an account? Sign up"));
    await waitFor(() => expect(view.getPathname()).toBe('/sign-up'));
  });
});

describe('sign-up', () => {
  test('after sign-up, goes to sign-in with the email filled in and a confirmation notice', async () => {
    auth.signUp.mockResolvedValue({
      data: { session: null, user: { id: 'u', identities: [{}] } },
      error: null,
    });
    const view = await openApp('/sign-up');
    await fill('new@example.com', 'password123');
    await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(view.getPathname()).toBe('/sign-in'));
    expect(screen.getByLabelText('Email')).toHaveDisplayValue('new@example.com');
    expect(
      screen.getByText(
        'We sent a confirmation link to new@example.com. Confirm your email, then sign in.',
      ),
    ).toBeTruthy();
    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'password123',
      options: { emailRedirectTo: 'http://127.0.0.1:8081/email-confirmed' },
    });
  });

  test('if the server signs the new user in anyway, signs out and asks them to sign in', async () => {
    auth.signUp.mockResolvedValue({
      data: { session: fakeSession, user: { id: 'u', identities: [{}] } },
      error: null,
    });
    const view = await openApp('/sign-up');
    await fill('new@example.com', 'password123');
    await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(view.getPathname()).toBe('/sign-in'));
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(screen.getByText('Account created. Sign in to continue.')).toBeTruthy();
    expect(screen.getByLabelText('Email')).toHaveDisplayValue('new@example.com');
  });

  test('existing email shows the sign-in hint', async () => {
    auth.signUp.mockResolvedValue({
      data: { session: null, user: null },
      error: { code: 'user_already_exists' },
    });
    await openApp('/sign-up');
    await fill('a@example.com', 'password123');
    await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() =>
      expect(
        screen.getByText('An account with this email already exists. Sign in instead.'),
      ).toBeTruthy(),
    );
  });

  test('existing email with confirmation on (fake user, no identities) shows the sign-in hint', async () => {
    auth.signUp.mockResolvedValue({
      data: { session: null, user: { id: 'u', identities: [] } },
      error: null,
    });
    await openApp('/sign-up');
    await fill('a@example.com', 'password123');
    await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() =>
      expect(
        screen.getByText('An account with this email already exists. Sign in instead.'),
      ).toBeTruthy(),
    );
    expect(
      screen.queryByText('Check your email to confirm your account, then sign in.'),
    ).toBeNull();
  });

  test('links to sign-in', async () => {
    const view = await openApp('/sign-up');
    await fireEvent.press(screen.getByText('Already have an account? Sign in'));
    await waitFor(() => expect(view.getPathname()).toBe('/sign-in'));
  });
});

describe('resend confirmation email', () => {
  const RESEND = 'Resend confirmation email';
  const REDIRECT = { emailRedirectTo: 'http://127.0.0.1:8081/email-confirmed' };

  async function failSignInUnconfirmed(url = '/sign-in', email = 'a@example.com') {
    auth.signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { code: 'email_not_confirmed' },
    });
    await openApp(url);
    if (email) await fill(email, 'password123');
    else await fireEvent.changeText(screen.getByLabelText('Password'), 'password123');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() =>
      expect(screen.getByText('Confirm your email first. Check your inbox, then sign in.')).toBeTruthy(),
    );
  }

  afterEach(() => jest.useRealTimers());

  test('is offered only after an email-not-confirmed error', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { code: 'invalid_credentials' },
    });
    await openApp('/sign-in');
    await fill('a@example.com', 'password123');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(screen.getByText('Email or password is incorrect.')).toBeTruthy());
    expect(screen.queryByRole('button', { name: RESEND })).toBeNull();
  });

  test('resends to the email in the field and confirms', async () => {
    auth.resend.mockResolvedValue({ data: {}, error: null });
    await failSignInUnconfirmed();
    await fireEvent.press(screen.getByRole('button', { name: RESEND }));
    expect(auth.resend).toHaveBeenCalledTimes(1);
    expect(auth.resend).toHaveBeenCalledWith({ type: 'signup', email: 'a@example.com', options: REDIRECT });
    await waitFor(() => expect(screen.getByText('Confirmation email sent to a@example.com.')).toBeTruthy());
  });

  test('uses the edited email, trimmed', async () => {
    auth.resend.mockResolvedValue({ data: {}, error: null });
    await failSignInUnconfirmed();
    await fireEvent.changeText(screen.getByLabelText('Email'), ' b@example.com ');
    await fireEvent.press(screen.getByRole('button', { name: RESEND }));
    expect(auth.resend).toHaveBeenCalledWith({ type: 'signup', email: 'b@example.com', options: REDIRECT });
  });

  test('an invalid email shows the validation message and sends nothing', async () => {
    await failSignInUnconfirmed();
    await fireEvent.changeText(screen.getByLabelText('Email'), 'nope');
    await fireEvent.press(screen.getByRole('button', { name: RESEND }));
    expect(screen.getByText('Enter a valid email address.')).toBeTruthy();
    expect(auth.resend).not.toHaveBeenCalled();
  });

  test('double tap sends one request; disabled while sending', async () => {
    let resolve!: (v: unknown) => void;
    auth.resend.mockReturnValue(new Promise((r) => (resolve = r)));
    await failSignInUnconfirmed();
    const button = screen.getByRole('button', { name: RESEND });
    await fireEvent.press(button);
    await fireEvent.press(button);
    expect(auth.resend).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: RESEND })).toBeDisabled();
    await act(async () => resolve({ data: {}, error: null }));
  });

  test('rate limit error shows a message and does not start the cooldown', async () => {
    auth.resend.mockResolvedValue({ data: {}, error: { code: 'over_email_send_rate_limit' } });
    await failSignInUnconfirmed();
    await fireEvent.press(screen.getByRole('button', { name: RESEND }));
    await waitFor(() =>
      expect(screen.getByText('Too many emails sent. Wait a few minutes and try again.')).toBeTruthy(),
    );
    expect(screen.getByRole('button', { name: RESEND })).toBeEnabled();
  });

  test('after a resend, counts down 60 seconds before allowing another', async () => {
    jest.useFakeTimers();
    auth.resend.mockResolvedValue({ data: {}, error: null });
    await failSignInUnconfirmed();
    await fireEvent.press(screen.getByRole('button', { name: RESEND }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Resend in 60s' })).toBeDisabled());
    await act(async () => jest.advanceTimersByTime(1000));
    expect(screen.getByRole('button', { name: 'Resend in 59s' })).toBeDisabled();
    await act(async () => jest.advanceTimersByTime(59000));
    expect(screen.getByRole('button', { name: RESEND })).toBeEnabled();
    await fireEvent.press(screen.getByRole('button', { name: RESEND }));
    expect(auth.resend).toHaveBeenCalledTimes(2);
  });

  test('arriving from sign-up, the countdown has already started', async () => {
    jest.useFakeTimers();
    await failSignInUnconfirmed('/sign-in?email=a%40example.com&notice=confirm-sent', '');
    expect(screen.getByRole('button', { name: /^Resend in \d+s$/ })).toBeDisabled();
  });
});
