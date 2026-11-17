import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { clearConfirmationUrl, readConfirmationUrl } from '@/auth/confirmationUrl';
import { queryClient } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import { fakeSession } from '@/test-utils/supabaseMock';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories must be self-contained
jest.mock('@/lib/supabase', () => require('@/test-utils/supabaseMock'));
jest.mock('@/auth/confirmationUrl', () => ({
  readConfirmationUrl: jest.fn(),
  clearConfirmationUrl: jest.fn(),
}));

const auth = supabase.auth as unknown as Record<string, jest.Mock>;
const readUrl = readConfirmationUrl as jest.Mock;

async function open(session: unknown = null) {
  auth.getSession.mockResolvedValue({ data: { session }, error: null });
  const view = await renderRouter('src/app', { initialUrl: '/email-confirmed' });
  await waitFor(() => expect(screen.queryByTestId('auth-loading')).toBeNull());
  return view;
}

beforeEach(() => {
  queryClient.clear();
  jest.clearAllMocks();
  readUrl.mockReturnValue({ search: '', hash: '#access_token=x&type=signup' });
});

test('confirmed: tells the user to go back and sign in', async () => {
  const view = await open();
  expect(screen.getByText('Email confirmed')).toBeTruthy();
  expect(screen.getByText('Go back to the app and sign in.')).toBeTruthy();
  await fireEvent.press(screen.getByText('Sign in'));
  await waitFor(() => expect(view.getPathname()).toBe('/sign-in'));
});

test('expired or used link explains how to get a new one', async () => {
  readUrl.mockReturnValue({ search: '', hash: '#error=access_denied&error_code=otp_expired' });
  await open();
  expect(screen.getByText('Link expired')).toBeTruthy();
  expect(
    screen.getByText("This link has expired or was already used. Sign in and we'll send you a new one."),
  ).toBeTruthy();
});

test('signed-in users see the page too (no redirect)', async () => {
  const view = await open(fakeSession);
  expect(view.getPathname()).toBe('/email-confirmed');
  expect(screen.getByText('Email confirmed')).toBeTruthy();
});

test('clears the URL after reading it and never signs anyone in', async () => {
  await open();
  expect(clearConfirmationUrl).toHaveBeenCalled();
  expect(auth.signInWithPassword).not.toHaveBeenCalled();
});
