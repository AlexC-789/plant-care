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

  test('links to sign-up', async () => {
    const view = await openApp('/sign-in');
    await fireEvent.press(screen.getByText("Don't have an account? Sign up"));
    await waitFor(() => expect(view.getPathname()).toBe('/sign-up'));
  });
});

describe('sign-up', () => {
  test('when email confirmation is required, tells the user to check their email', async () => {
    auth.signUp.mockResolvedValue({
      data: { session: null, user: { id: 'u' } },
      error: null,
    });
    await openApp('/sign-up');
    await fill('new@example.com', 'password123');
    await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() =>
      expect(screen.getByText('Check your email to confirm your account, then sign in.')).toBeTruthy(),
    );
    expect(auth.signUp).toHaveBeenCalledWith({ email: 'new@example.com', password: 'password123' });
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

  test('links to sign-in', async () => {
    const view = await openApp('/sign-up');
    await fireEvent.press(screen.getByText('Already have an account? Sign in'));
    await waitFor(() => expect(view.getPathname()).toBe('/sign-in'));
  });
});
