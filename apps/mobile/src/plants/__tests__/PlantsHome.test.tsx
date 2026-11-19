import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { usePlants } from '@/plants/queries';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme';
import { fakeSession } from '@/test-utils/supabaseMock';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories must be self-contained
jest.mock('@/lib/supabase', () => require('@/test-utils/supabaseMock'));
jest.mock('@/plants/queries', () => ({ usePlants: jest.fn() }));
// Add flow and plant detail routes don't exist yet (Tasks 10, 11): assert the push itself.
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 390, height: 844, scale: 3, fontScale: 1 })),
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports -- mocked above
const useWindowDimensions: jest.Mock = require('react-native/Libraries/Utilities/useWindowDimensions').default;
const auth = supabase.auth as unknown as Record<string, jest.Mock>;
const plant = (id: string, name: string, photo_path: string | null = null, device: unknown = null, over: object = {}) => ({
  id,
  name,
  photo_path,
  device,
  room: null,
  custom_type: null,
  ...over,
});
const ago = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const module = (over: Record<string, unknown> = {}) => ({
  id: 'd1',
  plant_id: 'p1',
  created_at: ago(1000),
  last_seen_at: ago(5),
  sync_interval_s: 3600,
  reading_ts: ago(5),
  soil_pct: 45,
  water_left_ml: 500,
  float_low: false,
  battery_pct: 80,
  charging: false,
  fault_code: null,
  tank_full_ml: 705,
  resumePending: false,
  ...over,
});

const refetch = jest.fn();
const fetchNextPage = jest.fn();
function state(over: Record<string, unknown>) {
  (usePlants as jest.Mock).mockReturnValue({
    data: undefined,
    isPending: false,
    isError: false,
    isRefetching: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    refetch,
    fetchNextPage,
    ...over,
  });
}
const loaded = (plants: unknown[], photoUrls = {}, over = {}) =>
  state({ data: { pages: [{ plants, photoUrls }] }, ...over });

async function openHome() {
  auth.getSession.mockResolvedValue({
    data: { session: fakeSession },
    error: null,
  });
  const view = await renderRouter('src/app', { initialUrl: '/' });
  await waitFor(() => expect(screen.queryByTestId('launch')).toBeNull(), {
    timeout: 3000,
  });
  return view;
}

beforeEach(() => {
  jest.clearAllMocks();
  useWindowDimensions.mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 1 });
});

test('shows skeleton rows only after 300 ms of loading, never a spinner', async () => {
  state({ isPending: true });
  await openHome();
  await waitFor(() => expect(screen.getByLabelText('Loading')).toBeTruthy());
  expect(screen.queryByText('No plants yet')).toBeNull();
});

test('empty state: No plants yet, and Scan a plant opens the add flow', async () => {
  loaded([]);
  await openHome();
  expect(screen.getByText('No plants yet')).toBeTruthy();
  expect(screen.getByText('Scan a plant to add it.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Scan a plant' }));
  expect(mockPush).toHaveBeenCalledWith('/add/photo');
});

test('the toolbar + is "Add a plant" and opens the add flow', async () => {
  loaded([plant('a', 'Fern')]);
  await openHome();
  await fireEvent.press(screen.getByRole('button', { name: 'Add a plant' }));
  expect(mockPush).toHaveBeenCalledWith('/add/photo');
});

test('need-you rows: name, "{type}, {room}" and the status sentence; a row opens its plant', async () => {
  loaded(
    [plant('b', 'Monstera', 'u/b.jpg', module({ float_low: true }), { room: 'Kitchen', species: { common_names: ['Swiss cheese plant'] } })],
    { 'u/b.jpg': 'https://x/b.jpg' },
  );
  await openHome();
  expect(screen.getByText('1 needs you')).toBeTruthy();
  expect(screen.getByText('Swiss cheese plant, Kitchen')).toBeTruthy();
  expect(screen.getByText('Tank needs refilling')).toHaveStyle({ color: colors.light.statusNow });
  await fireEvent.press(screen.getByRole('button', { name: /^Monstera/ }));
  expect(mockPush).toHaveBeenCalledWith('/plant/b');
});

test('the need-you heading is red only when a plant has a fault or an empty tank', async () => {
  loaded([plant('a', 'Fern', null, module({ fault_code: 'no_moisture_rise' })), plant('b', 'Aloe', null, module())]);
  await openHome();
  expect(screen.getByText('1 needs you')).toHaveStyle({ color: colors.light.statusNow });
  expect(screen.getByText('1 doing well')).toBeTruthy();
});

test('offline and a low battery need you, in ink', async () => {
  loaded([plant('a', 'Fern', null, module({ battery_pct: 5 })), plant('b', 'Aloe', null, module({ last_seen_at: ago(300) }))]);
  await openHome();
  expect(screen.getByText('2 need you')).toHaveStyle({ color: colors.light.label });
  expect(screen.getByText('Battery low')).toHaveStyle({ color: colors.light.label });
});

test('need you is ordered fault, tank, offline, battery', async () => {
  loaded([
    plant('a', 'Battery', null, module({ battery_pct: 5 })),
    plant('b', 'Offline', null, module({ last_seen_at: ago(300) })),
    plant('c', 'Tank', null, module({ float_low: true })),
    plant('d', 'Fault', null, module({ fault_code: 'x' })),
  ]);
  await openHome();
  const names = screen.getAllByRole('button', { name: /^(Battery|Offline|Tank|Fault),/ }).map((b) => b.props.accessibilityLabel.split(',')[0]);
  expect(names).toEqual(['Fault', 'Tank', 'Offline', 'Battery']);
});

test('no module and very wet soil are doing well; with nobody needing you the heading says All', async () => {
  loaded([plant('a', 'Fern'), plant('b', 'Aloe', null, module({ soil_pct: 80 }))]);
  await openHome();
  expect(screen.getByText('All 2 doing well')).toBeTruthy();
  expect(screen.queryByText(/need/)).toBeNull();
  expect(screen.getByText('No module')).toBeTruthy();
  expect(screen.getByText('Soil is very wet')).toBeTruthy();
});

const three = () => [plant('a', 'Fern', null, module()), plant('b', 'Aloe', null, module()), plant('c', 'Ivy', null, module())];

test('doing well is a two-column grid', async () => {
  loaded(three());
  await openHome();
  expect(screen.getAllByTestId('grid-row').map((r) => r.children.length)).toEqual([2, 2]); // the last pairs with a spacer
});

test('doing well is one column at accessibility sizes', async () => {
  useWindowDimensions.mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 3 });
  loaded(three());
  await openHome();
  expect(screen.getAllByTestId('grid-row')).toHaveLength(3);
});

test('a module shows its water line under the photo; a plant without one has none', async () => {
  loaded([plant('a', 'Fern', null, module({ water_left_ml: 350 })), plant('b', 'Aloe')]);
  await openHome();
  expect(screen.getAllByTestId('water-line', { includeHiddenElements: true })).toHaveLength(1);
  // The line is hidden from screen readers, so the row says it in words.
  expect(screen.getByRole('button', { name: 'Fern, Learning how fast it drinks, tank about 350 ml' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Aloe, No module' })).toBeTruthy();
});

test('an offline module draws no current level', async () => {
  loaded([plant('a', 'Fern', null, module({ last_seen_at: ago(300) }))]);
  await openHome();
  expect(screen.getByTestId('water-none', { includeHiddenElements: true })).toBeTruthy();
  expect(screen.getByRole('button', { name: /^Fern, Not heard from since [^,]+, tank no current reading$/ })).toBeTruthy();
});

test('long, emoji and right-to-left names render in full (they wrap)', async () => {
  const long = 'The very long name of my favourite fern from the north-facing windowsill 🌿🌿';
  const arabic = 'نبتة الصبار الكبيرة في غرفة المعيشة';
  loaded([plant('a', long), plant('b', arabic)]);
  await openHome();
  const name = screen.getByText(long);
  expect(screen.getByText(arabic)).toBeTruthy();
  expect(name.props.numberOfLines).toBeUndefined();
});

test('loads the next page at the end of the list when there is one', async () => {
  loaded([plant('a', 'Fern')], {}, { hasNextPage: true });
  await openHome();
  await act(async () => screen.getByTestId('plants-list').props.onEndReached());
  expect(fetchNextPage).toHaveBeenCalledTimes(1);
});

test('does not ask for another page when there is none', async () => {
  loaded([plant('a', 'Fern')]);
  await openHome();
  await act(async () => screen.getByTestId('plants-list').props.onEndReached());
  expect(fetchNextPage).not.toHaveBeenCalled();
});

test('refetches when Home regains focus, not on first open', async () => {
  loaded([plant('a', 'Fern')]);
  await openHome();
  expect(refetch).not.toHaveBeenCalled();
  await act(async () => router.push('/add/photo'));
  expect(screen).toHavePathname('/add/photo');
  await act(async () => router.back());
  expect(screen).toHavePathname('/');
  await waitFor(() => expect(refetch).toHaveBeenCalled());
});

test('pull to refresh refetches', async () => {
  loaded([plant('a', 'Fern')]);
  await openHome();
  await act(async () => screen.getByTestId('plants-list').props.onRefresh());
  expect(refetch).toHaveBeenCalled();
});

test('an error with nothing cached says so and Try again refetches', async () => {
  state({ isError: true });
  await openHome();
  expect(
    screen.getByText("Couldn't reach Plant Care. Check your connection and try again."),
  ).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(refetch).toHaveBeenCalled();
});
