import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { queryClient } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import * as devices from '@/devices/api';
import { fakeSession } from '@/test-utils/supabaseMock';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories must be self-contained
jest.mock('@/lib/supabase', () => require('@/test-utils/supabaseMock'));
jest.mock('@/devices/api', () => ({ ...jest.requireActual('@/devices/api'), fetchDevice: jest.fn() }));
const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => ({ ...jest.requireActual('expo-router').useRouter(), replace: mockReplace, back: mockBack }),
}));

const mocked = <T,>(f: T) => f as unknown as jest.Mock;
const auth = supabase.auth as unknown as Record<string, jest.Mock>;
const NOW = new Date('2026-11-18T12:00:00Z');
const device = { id: 'd1', plant_id: 'p1', water_left_ml: 100, tank_full_ml: 705, float_low: false };
let insert: jest.Mock;
let single: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  queryClient.clear();
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'], now: NOW });
  single = jest.fn().mockResolvedValue({
    data: { code: 'ABCD2345EFGH', expires_at: new Date(NOW.getTime() + 60_000).toISOString() },
    error: null,
  });
  insert = jest.fn(() => ({ select: () => ({ single }) }));
  mocked(supabase.from).mockReturnValue({ insert });
  mocked(devices.fetchDevice).mockResolvedValue(null);
  auth.getSession.mockResolvedValue({ data: { session: fakeSession }, error: null });
});
afterEach(() => jest.useRealTimers());

async function open(url: string) {
  await renderRouter('src/app', { initialUrl: url });
  await act(async () => jest.advanceTimersByTime(3000));
}
const tick = (ms = 5000) => act(async () => jest.advanceTimersByTime(ms));

describe('module step', () => {
  test('shows a grouped code and the simulator command', async () => {
    await open('/plant/p1/module');
    await waitFor(() => expect(screen.getByText('ABCD 2345 EFGH')).toBeTruthy());
    expect(screen.getByText(/node sim\/sim\.ts --claim ABCD2345EFGH/)).toBeTruthy();
    expect(screen.getByText('Waiting for the module…')).toBeTruthy();
    expect(screen.getByText(/Code expires at/)).toBeTruthy();
  });

  test('moves to the tank step when the module claims', async () => {
    await open('/plant/p1/module');
    await waitFor(() => expect(screen.getByText('ABCD 2345 EFGH')).toBeTruthy());
    mocked(devices.fetchDevice).mockResolvedValue(device);
    await tick();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/plant/p1/tank'));
  });

  test('an expired code offers New code, which makes another claim', async () => {
    await open('/plant/p1/module');
    await waitFor(() => expect(screen.getByText('ABCD 2345 EFGH')).toBeTruthy());
    await tick(65_000);
    expect(screen.getByText('This code expired.')).toBeTruthy();
    await fireEvent.press(screen.getByText('New code'));
    await waitFor(() => expect(insert).toHaveBeenCalledTimes(2));
  });

  test('only one claim is created on mount', async () => {
    await open('/plant/p1/module');
    await waitFor(() => expect(screen.getByText('ABCD 2345 EFGH')).toBeTruthy());
    await tick(5000);
    expect(insert).toHaveBeenCalledTimes(1);
  });
});

describe('tank step', () => {
  test('completes at 90 % full (634.5 ml)', async () => {
    mocked(devices.fetchDevice).mockResolvedValue({ ...device, water_left_ml: 635 });
    await open('/plant/p1/tank');
    await waitFor(() => expect(screen.getByText('The tank is full.')).toBeTruthy());
    await tick(800);
    expect(mockBack).toHaveBeenCalled();
  });

  test('Done leaves even when the tank is not full', async () => {
    mocked(devices.fetchDevice).mockResolvedValue({ ...device, water_left_ml: 634 });
    await open('/plant/p1/tank');
    await waitFor(() => expect(screen.getByText('Fill the tank')).toBeTruthy());
    expect(screen.queryByText('The tank is full.')).toBeNull();
    await fireEvent.press(screen.getByText('Done'));
    expect(mockBack).toHaveBeenCalled();
  });
});
