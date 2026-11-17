import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { queryClient } from '@/lib/queryClient';
import { resetAppearanceForTests } from '@/theme';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/profile/useProfile';
import { fakeSession } from '@/test-utils/supabaseMock';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories must be self-contained
jest.mock('@/lib/supabase', () => require('@/test-utils/supabaseMock'));

const mockWindow = { width: 390, height: 844, scale: 3, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockWindow,
}));

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
  await waitFor(() => expect(screen.queryByTestId('launch')).toBeNull(), { timeout: 3000 });
  await waitFor(() => expect(screen.getByText('a@example.com')).toBeTruthy());
  return view;
}

beforeEach(() => {
  queryClient.clear();
  resetAppearanceForTests();
  jest.clearAllMocks();
});

test('shows email and free plan, and no name field', async () => {
  mockProfile(profile);
  await openSettings();
  expect(screen.queryByLabelText('Display name')).toBeNull();
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
  expect(screen.getByRole('button', { name: 'Metric' })).not.toBeSelected();
});

test('units offer Automatic (from region) and save it', async () => {
  mockProfile(profile);
  await openSettings();
  expect(screen.getByRole('button', { name: 'Metric' })).toBeSelected();
  await fireEvent.press(screen.getByRole('button', { name: 'Automatic' }));
  await waitFor(() => expect(updates).toContainEqual({ units: 'auto' }));
  expect(screen.getByRole('button', { name: 'Automatic' })).toBeSelected();
});

test('labels are sentence case, not uppercase', async () => {
  mockProfile(profile);
  await openSettings();
  for (const header of ['Units', 'Plan', 'Account']) {
    expect(screen.getByText(header)).toBeTruthy();
  }
  expect(screen.queryByText('EMAIL')).toBeNull();
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
  // Local scope clears this device's session even when the server can't be reached.
  expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  await waitFor(() => expect(view.getPathname()).toBe('/sign-in'));
});


test('while the profile loads: email at once, skeletons for units and plan, no wrong values', async () => {
  (supabase.from as jest.Mock).mockImplementation(() => {
    const b: Record<string, jest.Mock> = {};
    b.select = jest.fn(() => b);
    b.eq = jest.fn(() => b);
    b.single = jest.fn(() => new Promise(() => {})); // never answers
    return b;
  });
  auth.getSession.mockResolvedValue({ data: { session: fakeSession }, error: null });
  await renderRouter('src/app', { initialUrl: '/settings' });
  await waitFor(() => expect(screen.getByText('a@example.com')).toBeTruthy());
  await waitFor(() => expect(screen.getAllByLabelText('Loading').length).toBe(2));
  expect(screen.queryByText('Free (testing)')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Automatic' })).toBeNull();
});

test('a failed load with nothing cached shows a dash, never a wrong plan', async () => {
  (supabase.from as jest.Mock).mockImplementation(() => {
    const b: Record<string, jest.Mock> = {};
    b.select = jest.fn(() => b);
    b.eq = jest.fn(() => b);
    b.single = jest.fn(async () => ({ data: null, error: { message: 'offline' } }));
    return b;
  });
  auth.getSession.mockResolvedValue({ data: { session: fakeSession }, error: null });
  await renderRouter('src/app', { initialUrl: '/settings' });
  await waitFor(() => expect(screen.getByText("Couldn't load your profile.")).toBeTruthy(), {
    timeout: 4000,
  });
  expect(screen.getByText('—')).toBeTruthy();
  expect(screen.queryByText('Free (testing)')).toBeNull();
});

describe('Appearance', () => {
  test('Light is chosen by default', async () => {
    mockProfile(profile);
    await openSettings();
    expect(screen.getByText('Appearance')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Light' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Dark' })).not.toBeSelected();
  });

  test('choosing Dark selects it and saves it on the phone', async () => {
    mockProfile(profile);
    await openSettings();
    await fireEvent.press(screen.getByRole('button', { name: 'Dark' }));
    expect(screen.getByRole('button', { name: 'Dark' })).toBeSelected();
    await waitFor(async () => expect(await AsyncStorage.getItem('plant-care.appearance')).toBe('dark'));
  });

  test('signing out keeps the choice', async () => {
    mockProfile(profile);
    await openSettings();
    await fireEvent.press(screen.getByRole('button', { name: 'Dark' }));
    const { emitAuthEvent } = jest.requireMock('@/lib/supabase');
    await act(async () => emitAuthEvent('SIGNED_OUT', null));
    expect(await AsyncStorage.getItem('plant-care.appearance')).toBe('dark');
  });
});
