import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { supabase } from '@/lib/supabase';
import type { Profile } from '@/profile/useProfile';
import { fakeSession } from '@/test-utils/supabaseMock';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories must be self-contained
jest.mock('@/lib/supabase', () => require('@/test-utils/supabaseMock'));

const auth = supabase.auth as unknown as Record<string, jest.Mock>;

const profile: Profile = {
  user_id: fakeSession.user.id,
  display_name: 'Alex',
  units: 'metric',
  notification_prefs: {},
  quiet_hours_start: null,
  quiet_hours_end: null,
  subscription_status: 'none',
  created_at: '2026-11-16T00:00:00Z',
  updated_at: '2026-11-16T00:00:00Z',
};

let updates: unknown[];

function mockProfile(row: Profile) {
  updates = [];
  (supabase.from as jest.Mock).mockImplementation(() => {
    let current = row;
    const b: Record<string, jest.Mock> = {};
    b.select = jest.fn(() => b);
    b.eq = jest.fn(() => b);
    b.update = jest.fn((patch) => {
      updates.push(patch);
      current = { ...row, ...patch };
      return b;
    });
    b.single = jest.fn(async () => ({ data: current, error: null }));
    return b;
  });
}

async function openSettings() {
  auth.getSession.mockResolvedValue({ data: { session: fakeSession }, error: null });
  const view = await renderRouter('src/app', { initialUrl: '/settings' });
  await waitFor(() => expect(screen.getByText('a@example.com')).toBeTruthy());
  await waitFor(() => expect(screen.getByDisplayValue('Alex')).toBeTruthy());
  return view;
}

beforeEach(() => jest.clearAllMocks());

test('shows email, name and free plan', async () => {
  mockProfile(profile);
  await openSettings();
  expect(screen.getByText('Free (testing)')).toBeTruthy();
});

test('shows Active for subscribers', async () => {
  mockProfile({ ...profile, subscription_status: 'active' });
  await openSettings();
  expect(screen.getByText('Active')).toBeTruthy();
});

test('switching to imperial saves units', async () => {
  mockProfile(profile);
  await openSettings();
  await fireEvent.press(screen.getByRole('button', { name: 'Imperial' }));
  await waitFor(() => expect(updates).toContainEqual({ units: 'imperial' }));
  expect(screen.getByRole('button', { name: 'Imperial' })).toBeSelected();
});

test('editing the display name saves on blur', async () => {
  mockProfile(profile);
  await openSettings();
  const input = screen.getByLabelText('Display name');
  await fireEvent.changeText(input, 'Alex C');
  await fireEvent(input, 'blur');
  await waitFor(() => expect(updates).toContainEqual({ display_name: 'Alex C' }));
});

test('sign out calls supabase and returns to sign-in', async () => {
  mockProfile(profile);
  const view = await openSettings();
  const { emitAuthEvent } = jest.requireMock('@/lib/supabase');
  auth.signOut.mockImplementation(async () => {
    emitAuthEvent('SIGNED_OUT', null);
    return { error: null };
  });
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
  });
  expect(auth.signOut).toHaveBeenCalled();
  await waitFor(() => expect(view.getPathname()).toBe('/sign-in'));
});
