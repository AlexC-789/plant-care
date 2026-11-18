import { StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { queryClient } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import * as api from '@/plants/api';
import * as photos from '@/plants/photos';
import { fakeSession } from '@/test-utils/supabaseMock';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories must be self-contained
jest.mock('@/lib/supabase', () => require('@/test-utils/supabaseMock'));
jest.mock('@/plants/api', () => ({
  ...jest.requireActual('@/plants/api'),
  fetchPlant: jest.fn(),
  fetchSpecies: jest.fn(),
  fetchLatestHealth: jest.fn(),
  checkHealth: jest.fn(),
}));
jest.mock('@/plants/photos', () => ({
  preparePhoto: jest.fn(),
  uploadPhoto: jest.fn(),
  deletePhotos: jest.fn().mockResolvedValue(undefined),
  signPhotoUrls: jest.fn(),
}));
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
// The edit route is Task 12's: record the push and don't navigate.
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => {
    const r = jest.requireActual('expo-router').useRouter();
    return { ...r, push: (href: string) => (mockPush(href), href.endsWith('/edit') ? undefined : r.push(href)) };
  },
}));

const mocked = <T,>(f: T) => f as unknown as jest.Mock;
const auth = supabase.auth as unknown as Record<string, jest.Mock>;
const LONG = 'A big glossy leafy plant that likes to climb. '.repeat(6);
const monstera = {
  id: 's1',
  common_names: ['Monstera'],
  scientific_name: 'Monstera deliciosa',
  description: LONG,
  light: 'bright_indirect',
  watering: 'Let the top soil dry out.',
};
const fern = { id: 'p1', name: 'Fernando', room: 'Kitchen', species_id: 's1', custom_type: null, photo_path: 'u/p.jpg' };
const LIMIT = "You've reached the health check limit for now. Try again later.";

let uploads = 0;
beforeEach(() => {
  jest.clearAllMocks();
  queryClient.clear();
  uploads = 0;
  mocked(api.fetchPlant).mockResolvedValue(fern);
  mocked(api.fetchSpecies).mockResolvedValue(monstera);
  mocked(api.fetchLatestHealth).mockResolvedValue(null);
  mocked(photos.signPhotoUrls).mockResolvedValue({ 'u/p.jpg': 'https://signed/p.jpg' });
  mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue({ granted: true });
  mocked(ImagePicker.launchCameraAsync).mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///raw.jpg' }] });
  mocked(photos.preparePhoto).mockResolvedValue({ uri: 'file:///prepared.jpg', width: 1, height: 1 });
  mocked(photos.uploadPhoto).mockImplementation(async () => `u/h${++uploads}.jpg`);
  auth.getSession.mockResolvedValue({ data: { session: fakeSession }, error: null });
});

async function open(url = '/plant/p1') {
  const view = await renderRouter('src/app', { initialUrl: url });
  await waitFor(() => expect(screen.queryByTestId('launch')).toBeNull(), { timeout: 3000 });
  return view;
}
const press = (name: string | RegExp, i = 0) => fireEvent.press(screen.getAllByRole('button', { name })[i]);

test('shows the hero photo (cached by path), title and "{type} · {room}"', async () => {
  await open();
  const hero = await screen.findByLabelText('Fernando photo');
  expect(hero.props.source).toEqual([{ uri: 'https://signed/p.jpg', cacheKey: 'u/p.jpg' }]);
  expect(screen.getByText('Fernando')).toBeTruthy();
  expect(screen.getByText('Monstera · Kitchen')).toBeTruthy();
});

test('without a photo it draws the pot; subtitle omits missing parts cleanly', async () => {
  mocked(api.fetchPlant).mockResolvedValue({ ...fern, photo_path: null, species_id: null, custom_type: 'Cactus', room: null });
  await open();
  await screen.findByText('Cactus');
  expect(screen.getByLabelText(/Drawing of a pot/)).toBeTruthy();
  expect(screen.queryByText(/·/)).toBeNull();
  expect(screen.queryByLabelText('Fernando photo')).toBeNull();
});

test('shows the setup banner without a button', async () => {
  await open();
  await screen.findByText("Setup isn't finished");
  expect(screen.getByText('The module steps arrive in the next build.')).toBeTruthy();
});

test('About shows description, light and watering; More expands', async () => {
  await open();
  const desc = await screen.findByText(LONG.trim());
  expect(desc.props.numberOfLines).toBe(3);
  expect(screen.getByText('Bright, indirect light')).toBeTruthy();
  expect(screen.getByText('Let the top soil dry out.')).toBeTruthy();
  await press('More');
  expect(screen.getByText(LONG.trim()).props.numberOfLines).toBeUndefined();
  expect(screen.queryByRole('button', { name: 'More' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Less' })).toBeTruthy();
});

test('About is hidden for a custom type and for a species without facts', async () => {
  mocked(api.fetchPlant).mockResolvedValue({ ...fern, species_id: null, custom_type: 'Cactus' });
  await open();
  await screen.findByText('Cactus · Kitchen');
  expect(screen.queryByText('About this plant')).toBeNull();
});

test('About is hidden when the species has no facts', async () => {
  mocked(api.fetchSpecies).mockResolvedValue({ ...monstera, description: null, light: null, watering: null });
  await open();
  await screen.findByText('Monstera · Kitchen');
  expect(screen.queryByText('About this plant')).toBeNull();
});

test('skeletons appear after 300 ms while loading, never a spinner', async () => {
  mocked(api.fetchPlant).mockReturnValue(new Promise(() => {}));
  await open();
  await waitFor(() => expect(screen.getByLabelText('Loading')).toBeTruthy());
  expect(screen.queryByText("Setup isn't finished")).toBeNull();
});

test('a failed load with no cache shows a dash, not a guessed value', async () => {
  mocked(api.fetchPlant).mockRejectedValue(new Error('x'));
  await open();
  await screen.findByText('—', undefined, { timeout: 5000 });
  expect(StyleSheet.flatten(screen.getByTestId('plant-hero').props.style).backgroundColor).toBe('#FFFDF9');
});

test('health card shows the latest result with its date, and the Check button', async () => {
  mocked(api.fetchLatestHealth).mockResolvedValue({
    created_at: '2026-11-10T12:00:00Z',
    health: { healthy: false, note: 'Some leaves look yellow.', advice: 'Often too much water.' },
  });
  await open();
  const date = new Date('2026-11-10T12:00:00Z').toLocaleDateString();
  await screen.findByText(`Checked ${date}`);
  expect(screen.getByText('Some leaves look yellow.')).toBeTruthy();
  expect(screen.getByText('Often too much water.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Check its health' })).toBeTruthy();
});

test('the "..." menu offers Edit plant', async () => {
  await open();
  await screen.findByText('Fernando');
  await press('More options');
  await press('Edit plant');
  expect(mockPush).toHaveBeenCalledWith('/plant/p1/edit');
});

test('Check its health opens a two-card capture; Check needs the whole-plant photo, then shows the result', async () => {
  mocked(api.checkHealth).mockResolvedValue({ healthy: true, note: 'It looks healthy in this photo.', advice: null });
  await open();
  await screen.findByText('Fernando');
  await press('Check its health');
  expect(await screen.findByText('Whole plant')).toBeTruthy();
  expect(screen.getByText('Problem spot')).toBeTruthy();
  expect(screen.getByText('If something looks wrong')).toBeTruthy();
  expect(screen.getAllByRole('button', { name: 'Take photo' })).toHaveLength(2);
  expect(screen.getByRole('button', { name: 'Check' }).props.accessibilityState.disabled).toBe(true);
  await press('Take photo', 0);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Check' }).props.accessibilityState.disabled).toBe(false));
  expect(api.checkHealth).not.toHaveBeenCalled();
  mocked(api.fetchLatestHealth).mockResolvedValue({
    created_at: '2026-11-17T12:00:00Z',
    health: { healthy: true, note: 'It looks healthy in this photo.', advice: null },
  });
  await press('Check');
  expect(api.checkHealth).toHaveBeenCalledWith('p1', ['u/h1.jpg']);
  await screen.findByText('It looks healthy in this photo.');
  await press('Done');
  await screen.findByText(/^Checked /);
  // The photos belong to the scan now: nothing deleted.
  expect(photos.deletePhotos).not.toHaveBeenCalled();
});

test('shows "Looking at your plant…" while checking', async () => {
  mocked(api.checkHealth).mockReturnValue(new Promise(() => {}));
  await open('/plant/p1/health');
  await press('Take photo', 0);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Check' }).props.accessibilityState.disabled).toBe(false));
  await press('Check');
  await screen.findByText('Looking at your plant…');
});

test.each([
  ['the limit', new Error(LIMIT), LIMIT],
  ['another failure', new Error('boom'), "Couldn't check right now. Try again."],
])('a health check failing with %s shows its message', async (_n, error, message) => {
  mocked(api.checkHealth).mockRejectedValue(error);
  await open('/plant/p1/health');
  await press('Take photo', 0);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Check' }).props.accessibilityState.disabled).toBe(false));
  await press('Check');
  await screen.findByText(message);
});

test('leaving the health screen before Check deletes the uploaded photos', async () => {
  await open('/plant/p1');
  await screen.findByText('Fernando');
  await press('Check its health');
  await screen.findByText('Whole plant');
  await press('Take photo', 0);
  await screen.findByLabelText('Whole plant photo');
  await act(async () => router.back());
  await waitFor(() => expect(photos.deletePhotos).toHaveBeenCalledWith(['u/h1.jpg']));
});

test('a camera that rejects shows the failure copy instead of an unhandled rejection', async () => {
  mocked(ImagePicker.launchCameraAsync).mockRejectedValue(new Error('no camera'));
  await open('/plant/p1/health');
  await press('Take photo', 0);
  await screen.findByText("Couldn't add that photo. Try again.");
});

test('the detail shows "Not checked yet." with no checks, and "Looking at your plant…" while one runs', async () => {
  mocked(api.checkHealth).mockReturnValue(new Promise(() => {}));
  await open('/plant/p1');
  await screen.findByText('Not checked yet.');
  await press('Check its health');
  await screen.findByText('Whole plant');
  await press('Take photo', 0);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Check' }).props.accessibilityState.disabled).toBe(false));
  await press('Check');
  await act(async () => router.back());
  await screen.findByText('Looking at your plant…');
  expect(screen.queryByText('Not checked yet.')).toBeNull();
});

test('a check that failed shows one line under the button on the detail', async () => {
  mocked(api.checkHealth).mockRejectedValue(new Error(LIMIT));
  await open('/plant/p1');
  await screen.findByText('Not checked yet.');
  await press('Check its health');
  await screen.findByText('Whole plant');
  await press('Take photo', 0);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Check' }).props.accessibilityState.disabled).toBe(false));
  await press('Check');
  await screen.findByText(LIMIT);
  await act(async () => router.back());
  await screen.findByText('Not checked yet.');
  expect(screen.getAllByText(LIMIT)).toHaveLength(1);
});

test('the hero is full-bleed: 1.25 x width, capped at 460, photo covers it', async () => {
  await open();
  const hero = await screen.findByLabelText('Fernando photo');
  expect(hero.props.contentFit).toBe('cover');
  expect(StyleSheet.flatten(screen.getByTestId('plant-hero').props.style).height).toBe(460);
});

test('a plant named like its type shows the scientific name in italics, then the room', async () => {
  mocked(api.fetchPlant).mockResolvedValue({ ...fern, name: 'monstera' });
  await open();
  const sub = await screen.findByText('Monstera deliciosa');
  expect(StyleSheet.flatten(sub.props.style).fontStyle).toBe('italic');
  expect(screen.getByText(/Kitchen/)).toBeTruthy();
});

test('About leads with Light and Watering facts; the description has an inline More / Less', async () => {
  await open();
  await screen.findByText('About this plant');
  expect(screen.getByText('Light')).toBeTruthy();
  expect(screen.getByText('Watering')).toBeTruthy();
  await press('More');
  await press('Less');
  expect(screen.getByText(LONG.trim()).props.numberOfLines).toBe(3);
});

async function checkWith(result: object, photoCount = 1) {
  mocked(api.checkHealth).mockResolvedValue(result);
  let n = 0;
  mocked(photos.preparePhoto).mockImplementation(async () => ({ uri: `file:///p${++n}.jpg`, width: 1, height: 1 }));
  await open('/plant/p1/health');
  for (let i = 0; i < photoCount; i++) await press('Take photo', i);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Check' }).props.accessibilityState.disabled).toBe(false));
  await press('Check');
}

test.each([
  [true, 'Looks healthy'],
  [false, 'Needs attention'],
  [null, 'Not sure'],
])('the health result shows the status line for healthy=%s', async (healthy, label) => {
  await checkWith({ healthy, note: 'A note.', advice: null });
  await screen.findByText('A note.');
  expect(screen.getByText(label)).toBeTruthy();
  expect(screen.queryByText('What to do')).toBeNull();
});

test('the health result shows the checked photo, preferring the problem spot, and a "What to do" card with advice', async () => {
  await checkWith({ healthy: false, note: 'Brown tips.', advice: 'Water less.' }, 2);
  await screen.findByText('Brown tips.');
  expect(screen.getByLabelText('Checked photo').props.source).toEqual([{ uri: 'file:///p2.jpg' }]);
  expect(screen.getByText('What to do')).toBeTruthy();
  expect(screen.getByText('Water less.')).toBeTruthy();
});

test('without a problem photo the result shows the whole-plant photo', async () => {
  await checkWith({ healthy: true, note: 'Fine.', advice: null });
  await screen.findByText('Fine.');
  expect(screen.getByLabelText('Checked photo').props.source).toEqual([{ uri: 'file:///p1.jpg' }]);
});

test('Check and Done sit in the bottom bar', async () => {
  await open('/plant/p1/health');
  expect(screen.getByTestId('bottom-bar')).toBeTruthy();
  await press('Take photo', 0);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Check' }).props.accessibilityState.disabled).toBe(false));
  mocked(api.checkHealth).mockResolvedValue({ healthy: true, note: 'ok', advice: null });
  await press('Check');
  await screen.findByText('ok');
  expect(screen.getByTestId('bottom-bar')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy();
});
