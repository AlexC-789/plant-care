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

const auth = supabase.auth as unknown as Record<string, jest.Mock>;
const plant = (id: string, name: string, photo_path: string | null = null) => ({
  id,
  name,
  photo_path,
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

beforeEach(() => jest.clearAllMocks());

test('shows skeleton rows only after 300 ms of loading, never a spinner', async () => {
  state({ isPending: true });
  await openHome();
  await waitFor(() => expect(screen.getByLabelText('Loading')).toBeTruthy());
  expect(screen.queryByText('No plants yet')).toBeNull();
});

test('empty state explains and the Add a pot button opens the add flow', async () => {
  loaded([]);
  await openHome();
  expect(screen.getByText('No plants yet')).toBeTruthy();
  expect(
    screen.getByText("Add your first pot and it'll look after its own watering from then on."),
  ).toBeTruthy();
  await fireEvent.press(screen.getByText('Add a pot'));
  expect(mockPush).toHaveBeenCalledWith('/add/photo');
});

test('the toolbar plus opens the add flow', async () => {
  loaded([plant('a', 'Fern')]);
  await openHome();
  await fireEvent.press(screen.getByLabelText('Add a pot'));
  expect(mockPush).toHaveBeenCalledWith('/add/photo');
});

test('rows show name and status line, with the summary; a row opens its plant', async () => {
  loaded([plant('a', 'Fern'), plant('b', 'Monstera', 'u/b.jpg')], {
    'u/b.jpg': 'https://x/b.jpg',
  });
  await openHome();
  expect(screen.getByText('2 need you')).toBeTruthy();
  expect(screen.getByText('Fern')).toBeTruthy();
  expect(screen.getAllByText("Setup isn't finished · Add its module")).toHaveLength(2);
  expect(screen.queryByText('Needs you')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: /^Monstera/ }));
  expect(mockPush).toHaveBeenCalledWith('/plant/b');
});

test('the status marker is a solid dot (the Material font has no filled circle)', async () => {
  loaded([plant('a', 'Fern')]);
  await openHome();
  expect(screen.getByTestId('status-dot')).toHaveStyle({ backgroundColor: colors.light.statusQuiet });
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
