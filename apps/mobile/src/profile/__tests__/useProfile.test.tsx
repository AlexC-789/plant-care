import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useSession } from '@/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { useEntitlement } from '@/profile/useEntitlement';
import { useProfile, type Profile } from '@/profile/useProfile';
import { createQueryWrapper } from '@/test-utils/queryWrapper';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories must be self-contained
jest.mock('@/lib/supabase', () => require('@/test-utils/supabaseMock'));
jest.mock('@/auth/AuthProvider', () => ({ useSession: jest.fn() }));

const USER_ID = '11111111-1111-1111-1111-111111111111';

const baseProfile: Profile = {
  user_id: USER_ID,
  display_name: null,
  units: 'metric',
  notification_prefs: {},
  quiet_hours_start: null,
  quiet_hours_end: null,
  subscription_status: 'none',
  created_at: '2026-11-16T00:00:00Z',
  updated_at: '2026-11-16T00:00:00Z',
};

/** Minimal chainable stand-in for supabase.from('profiles'). */
function mockProfilesTable(opts: {
  select?: { data: Profile | null; error: unknown };
  update?: { data: Profile | null; error: unknown };
}) {
  const calls = { update: [] as unknown[], eq: [] as unknown[][] };
  const builder: Record<string, jest.Mock> = {};
  let mode: 'select' | 'update' = 'select';
  builder.select = jest.fn(() => builder);
  builder.update = jest.fn((patch) => {
    mode = 'update';
    calls.update.push(patch);
    return builder;
  });
  builder.eq = jest.fn((...args) => {
    calls.eq.push(args);
    return builder;
  });
  builder.single = jest.fn(async () => (mode === 'update' ? opts.update : opts.select));
  (supabase.from as jest.Mock).mockImplementation(() => {
    mode = 'select';
    return builder;
  });
  return calls;
}

let wrapper: ReturnType<typeof createQueryWrapper>['wrapper'];
let client: ReturnType<typeof createQueryWrapper>['client'];

beforeEach(() => {
  ({ wrapper, client } = createQueryWrapper());
  jest.clearAllMocks();
  (useSession as jest.Mock).mockReturnValue({
    session: { user: { id: USER_ID, email: 'a@example.com' } },
    isLoading: false,
  });
});

test('loads the signed-in user\'s profile', async () => {
  const calls = mockProfilesTable({ select: { data: baseProfile, error: null } });
  const { result } = await renderHook(() => useProfile(), { wrapper });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.profile).toEqual(baseProfile);
  expect(supabase.from).toHaveBeenCalledWith('profiles');
  expect(calls.eq).toContainEqual(['user_id', USER_ID]);
});

test('update sends only the changed column and refreshes state', async () => {
  const updated = { ...baseProfile, units: 'imperial' };
  const calls = mockProfilesTable({
    select: { data: baseProfile, error: null },
    update: { data: updated, error: null },
  });
  const { result } = await renderHook(() => useProfile(), { wrapper });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  await act(async () => result.current.update({ units: 'imperial' }));
  expect(calls.update).toEqual([{ units: 'imperial' }]);
  expect(result.current.profile?.units).toBe('imperial');
  expect(result.current.error).toBeNull();
});

test('a failed update sets an error and keeps the old profile', async () => {
  mockProfilesTable({
    select: { data: baseProfile, error: null },
    update: { data: null, error: { message: 'permission denied' } },
  });
  const { result } = await renderHook(() => useProfile(), { wrapper });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  await act(async () => result.current.update({ units: 'imperial' }));
  expect(result.current.profile).toEqual(baseProfile);
  expect(result.current.error).toBe("Couldn't save your changes. Please try again.");
});

test('a failed load sets an error', async () => {
  mockProfilesTable({ select: { data: null, error: { message: 'boom' } } });
  const { result } = await renderHook(() => useProfile(), { wrapper });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.profile).toBeNull();
  expect(result.current.error).toBe("Couldn't load your profile.");
});

test.each([
  ['active', true],
  ['none', false],
  ['expired', false],
])('useEntitlement: subscription_status %s → isSubscribed %p', async (status, expected) => {
  mockProfilesTable({ select: { data: { ...baseProfile, subscription_status: status }, error: null } });
  const { result } = await renderHook(() => useEntitlement(), { wrapper });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.isSubscribed).toBe(expected);
});

test('useEntitlement is not subscribed while the profile is loading', async () => {
  (supabase.from as jest.Mock).mockImplementation(() => {
    const b: Record<string, jest.Mock> = {};
    b.select = jest.fn(() => b);
    b.eq = jest.fn(() => b);
    b.single = jest.fn(() => new Promise(() => {}));
    return b;
  });
  const { result } = await renderHook(() => useEntitlement(), { wrapper });
  expect(result.current).toEqual({ isSubscribed: false, isLoading: true });
});

test('a second screen using the profile gets it from the cache instantly', async () => {
  mockProfilesTable({ select: { data: baseProfile, error: null } });
  const first = await renderHook(() => useProfile(), { wrapper });
  await waitFor(() => expect(first.result.current.isLoading).toBe(false));
  // From now on the server never answers: only a cache can provide the profile.
  (supabase.from as jest.Mock).mockImplementation(() => {
    const b: Record<string, jest.Mock> = {};
    b.select = jest.fn(() => b);
    b.eq = jest.fn(() => b);
    b.single = jest.fn(() => new Promise(() => {}));
    return b;
  });
  const second = await renderHook(() => useProfile(), { wrapper });
  expect(second.result.current.isLoading).toBe(false);
  expect(second.result.current.profile).toEqual(baseProfile);
});

test('a failed refresh keeps the cached profile and reports the error', async () => {
  client.setQueryData(['profile', USER_ID], baseProfile);
  mockProfilesTable({ select: { data: null, error: { message: 'offline' } } });
  const { result } = await renderHook(() => useProfile(), { wrapper });
  await act(async () => {
    await client.refetchQueries({ queryKey: ['profile', USER_ID] });
  });
  await waitFor(() => expect(result.current.error).toBe("Couldn't load your profile."));
  expect(result.current.profile).toEqual(baseProfile);
});
