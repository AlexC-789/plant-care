import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { queryClient } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import * as api from '@/plants/api';
import { fakeSession } from '@/test-utils/supabaseMock';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories must be self-contained
jest.mock('@/lib/supabase', () => require('@/test-utils/supabaseMock'));
jest.mock('@/plants/api', () => ({
  ...jest.requireActual('@/plants/api'),
  fetchPlantPhotos: jest.fn(),
  deletePlantPhoto: jest.fn(),
  identifyPlant: jest.fn(),
  updatePlant: jest.fn(),
  linkScan: jest.fn(),
}));
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => ({ ...jest.requireActual('expo-router').useRouter(), back: () => mockBack() }),
}));

const mocked = <T,>(f: T) => f as unknown as jest.Mock;
const auth = supabase.auth as unknown as Record<string, jest.Mock>;
const LIMIT = "You've reached the identification limit for now. Search for the plant type, or try again later.";
const COULDNT = "Couldn't tell from this photo. Try one with a whole leaf in view, or search.";

const day = (n: number) => new Date(2026, 10, n, 12);
const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const photo = (i: number, extra: Partial<api.PlantPhoto> = {}): api.PlantPhoto => ({
  id: `f${i}`,
  path: `u/${i}.jpg`,
  taken_at: day(28 - i).toISOString(),
  scan_id: null,
  health: null,
  ...extra,
});
const page = (photos: api.PlantPhoto[]) => ({
  photos,
  photoUrls: Object.fromEntries(photos.map((p) => [p.path, `https://s/${p.id}`])),
});
const PAGE = api.PAGE_SIZE;

beforeEach(() => {
  jest.clearAllMocks();
  queryClient.clear();
  auth.getSession.mockResolvedValue({ data: { session: fakeSession }, error: null });
  mocked(api.deletePlantPhoto).mockResolvedValue(undefined);
  mocked(api.updatePlant).mockResolvedValue({ id: 'p1', species_id: 's1' });
  mocked(api.linkScan).mockResolvedValue(undefined);
});

function pages(n: number, first: (i: number) => Partial<api.PlantPhoto> = () => ({})) {
  mocked(api.fetchPlantPhotos).mockImplementation(async (_id: string, p: number) =>
    page(Array.from({ length: Math.min(PAGE, n - p * PAGE) }, (_, k) => photo(p * PAGE + k, first(p * PAGE + k)))),
  );
}
async function open(start = 0) {
  await renderRouter('src/app', { initialUrl: `/plant/p1/photos?start=${start}` });
  await waitFor(() => expect(screen.queryByTestId('launch')).toBeNull(), { timeout: 3000 });
}
const press = (name: string | RegExp) => fireEvent.press(screen.getByRole('button', { name }));
const swipeTo = (i: number) =>
  fireEvent(screen.getByTestId('photo-list'), 'momentumScrollEnd', {
    nativeEvent: { contentOffset: { x: i * 750, y: 0 }, layoutMeasurement: { width: 750, height: 1 } },
  });

test('opens at the start index and shows its date', async () => {
  pages(3);
  await open(1);
  expect(await screen.findByText(fmt(day(27)))).toBeTruthy();
  expect(screen.getByTestId('photo-list').props.initialScrollIndex).toBe(1);
});

test('a start index on page 2 fetches that page first', async () => {
  pages(PAGE + 5);
  await open(PAGE + 2);
  expect(await screen.findByText(fmt(day(28 - (PAGE + 2))))).toBeTruthy();
  expect(mocked(api.fetchPlantPhotos)).toHaveBeenCalledWith('p1', 1);
  expect(screen.getByTestId('photo-list').props.initialScrollIndex).toBe(PAGE + 2);
});

test('a checked photo shows status, note and advice; swiping changes the info', async () => {
  pages(2, (i) => (i === 0 ? { health: { healthy: false, note: 'Brown tips', advice: 'Water less' } } : {}));
  await open(0);
  expect(await screen.findByText('Needs attention')).toBeTruthy();
  expect(screen.getByText('Brown tips')).toBeTruthy();
  expect(screen.getByText('Water less')).toBeTruthy();
  await swipeTo(1);
  expect(screen.getByText(fmt(day(27)))).toBeTruthy();
  expect(screen.queryByText('Brown tips')).toBeNull();
});

test('Delete photo asks first, then deletes once', async () => {
  pages(2);
  await open(1);
  await screen.findByText(fmt(day(27)));
  await press('Delete photo');
  expect(screen.getByText("Delete this photo? This can't be undone.")).toBeTruthy();
  expect(api.deletePlantPhoto).not.toHaveBeenCalled();
  const del = screen.getByRole('button', { name: 'Delete' });
  await fireEvent.press(del);
  await fireEvent.press(del);
  await waitFor(() => expect(api.deletePlantPhoto).toHaveBeenCalledTimes(1));
  expect(api.deletePlantPhoto).toHaveBeenCalledWith('p1', { id: 'f1', path: 'u/1.jpg' });
  expect(mockBack).not.toHaveBeenCalled();
});

test('Cancel keeps the photo', async () => {
  pages(2);
  await open();
  await screen.findByText(fmt(day(28)));
  await press('Delete photo');
  await press('Cancel');
  expect(screen.queryByText("Delete this photo? This can't be undone.")).toBeNull();
  expect(api.deletePlantPhoto).not.toHaveBeenCalled();
});

test('deleting the last photo closes the viewer', async () => {
  pages(1);
  await open();
  await screen.findByText(fmt(day(28)));
  await press('Delete photo');
  await press('Delete');
  await waitFor(() => expect(mockBack).toHaveBeenCalled());
});

test('What is it? identifies once, then a pick sets the type and links the scan', async () => {
  pages(1);
  let resolve!: (v: unknown) => void;
  mocked(api.identifyPlant).mockReturnValue(new Promise((r) => (resolve = r)));
  await open();
  await screen.findByText(fmt(day(28)));
  const ask = screen.getByRole('button', { name: 'What is it?' });
  await fireEvent.press(ask);
  await fireEvent.press(ask);
  await act(async () =>
    resolve({
      scanId: 'scan1',
      isPlant: true,
      suggestions: [{ speciesId: 's1', commonName: 'Monstera', scientificName: 'Monstera deliciosa', confidence: 'likely' }],
    }),
  );
  await fireEvent.press(await screen.findByRole('button', { name: /Monstera, Monstera deliciosa/ }));
  await waitFor(() => expect(api.updatePlant).toHaveBeenCalledWith('p1', { species_id: 's1' }));
  await waitFor(() => expect(api.linkScan).toHaveBeenCalledWith('scan1', 'p1'));
  expect(api.identifyPlant).toHaveBeenCalledTimes(1);
  expect(api.identifyPlant).toHaveBeenCalledWith(['u/0.jpg']);
});

test('shows the limit message and the "couldn\'t tell" copy', async () => {
  pages(1);
  mocked(api.identifyPlant).mockRejectedValueOnce(new Error(LIMIT));
  await open();
  await screen.findByText(fmt(day(28)));
  await press('What is it?');
  expect(await screen.findByText(LIMIT)).toBeTruthy();
  mocked(api.identifyPlant).mockResolvedValueOnce({ isPlant: false, suggestions: [] });
  await press('What is it?');
  expect(await screen.findByText(COULDNT)).toBeTruthy();
});
