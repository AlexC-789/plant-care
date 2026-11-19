import { StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { queryClient } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import * as devices from '@/devices/api';
import * as api from '@/plants/api';
import * as photos from '@/plants/photos';
import { fakeSession } from '@/test-utils/supabaseMock';
import { colors, fonts } from '@/theme';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories must be self-contained
jest.mock('@/lib/supabase', () => require('@/test-utils/supabaseMock'));
jest.mock('@/plants/api', () => ({
  ...jest.requireActual('@/plants/api'),
  fetchPlant: jest.fn(),
  fetchSpecies: jest.fn(),
  checkHealth: jest.fn(),
  fetchPlantPhotos: jest.fn(),
  addPlantPhoto: jest.fn(),
  deletePlant: jest.fn(),
}));
jest.mock('@/devices/api', () => ({
  ...jest.requireActual('@/devices/api'),
  fetchDevice: jest.fn(),
  resumeWatering: jest.fn(),
  removeDevice: jest.fn(),
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
// The edit and photos routes aren't under test here: record the push and don't navigate.
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => {
    const r = jest.requireActual('expo-router').useRouter();
    return { ...r, push: (href: string) => (mockPush(href), /\/edit$|\/photos\?/.test(href) ? undefined : r.push(href)) };
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
  mocked(api.fetchPlantPhotos).mockResolvedValue({ photos: [], photoUrls: {} });
  mocked(devices.fetchDevice).mockResolvedValue(null);
  mocked(devices.resumeWatering).mockResolvedValue(undefined);
  mocked(devices.removeDevice).mockResolvedValue(undefined);
  mocked(photos.signPhotoUrls).mockResolvedValue({ 'u/p.jpg': 'https://signed/p.jpg' });
  mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue({ granted: true });
  mocked(ImagePicker.launchCameraAsync).mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///raw.jpg' }] });
  mocked(photos.preparePhoto).mockResolvedValue({ uri: 'file:///prepared.jpg', width: 1, height: 1, base64: 'AQID' });
  mocked(photos.uploadPhoto).mockImplementation(async () => `u/h${++uploads}.jpg`);
  auth.getSession.mockResolvedValue({ data: { session: fakeSession }, error: null });
});

async function open(url = '/plant/p1') {
  const view = await renderRouter('src/app', { initialUrl: url });
  await waitFor(() => expect(screen.queryByTestId('launch')).toBeNull(), { timeout: 3000 });
  return view;
}
const press = (name: string | RegExp, i = 0) => fireEvent.press(screen.getAllByRole('button', { name })[i]);

const minsAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const dev = (over: object = {}) => ({
  id: 'd1',
  plant_id: 'p1',
  created_at: minsAgo(1000),
  last_seen_at: minsAgo(10) as string | null,
  sync_interval_s: 3600,
  reading_ts: minsAgo(10) as string | null,
  soil_pct: 41 as number | null,
  water_left_ml: 500 as number | null,
  float_low: false,
  battery_pct: 78 as number | null,
  charging: false,
  fault_code: null as string | null,
  tank_full_ml: 705,
  resumePending: false,
  ...over,
});
const headline = () => StyleSheet.flatten(screen.getByTestId('status-headline').props.style);

test('shows the hero photo (cached by path), the name and "{Latin}, {room}" with the Latin name in italics', async () => {
  await open();
  const hero = await screen.findByLabelText('Fernando photo');
  expect(hero.props.source).toEqual([{ uri: 'https://signed/p.jpg', cacheKey: 'u/p.jpg' }]);
  expect(screen.getByText('Fernando')).toBeTruthy();
  expect(screen.getByText('Monstera deliciosa, Kitchen')).toBeTruthy();
  expect(StyleSheet.flatten(screen.getByText('Monstera deliciosa').props.style).fontFamily).toBe(fonts.italic);
  expect(screen.queryByText(/·/)).toBeNull();
});

test('without a photo it draws the pot; the subhead omits missing parts cleanly', async () => {
  mocked(api.fetchPlant).mockResolvedValue({ ...fern, photo_path: null, species_id: null, custom_type: 'Cactus', room: null });
  await open();
  await screen.findByText('Cactus');
  expect(screen.getByLabelText(/Drawing of a pot/)).toBeTruthy();
  expect(screen.queryByLabelText('Fernando photo')).toBeNull();
});

test('the hero is 290 high from the top, the photo covers it, and the room sits on it', async () => {
  await open();
  const hero = await screen.findByLabelText('Fernando photo');
  expect(hero.props.contentFit).toBe('cover');
  expect(StyleSheet.flatten(screen.getByTestId('plant-hero').props.style).height).toBe(290);
  expect(screen.getByTestId('hero-pills')).toHaveTextContent('Kitchen');
});

test('no module: its headline and line, Set up a module and Check its health, no tank bar', async () => {
  await open();
  await screen.findByText('No module yet');
  expect(screen.getByText('Photos and health checks only. Set up a module to water it automatically.')).toBeTruthy();
  expect(headline().color).toBe(colors.light.label);
  expect(screen.queryByLabelText(/^Tank/)).toBeNull();
  expect(screen.getByRole('button', { name: 'Check its health' })).toBeTruthy();
  await press('Set up a module');
  expect(mockPush).toHaveBeenCalledWith('/plant/p1/module');
});

test('with a module: status, tank bar, Soil and Battery rows', async () => {
  mocked(devices.fetchDevice).mockResolvedValue(dev({ charging: true }));
  await open();
  await screen.findByText('About 500 ml');
  expect(screen.getByText('of 705 ml')).toBeTruthy();
  expect(screen.getByText('Learning how fast it drinks')).toBeTruthy();
  expect(screen.getByText('Damp, 41 %')).toBeTruthy();
  expect(screen.getByText('78 %, charging')).toBeTruthy();
  expect(screen.queryByText('No module yet')).toBeNull();
});

test('unknown values show a dash and the tank says it has no reading', async () => {
  mocked(devices.fetchDevice).mockResolvedValue(
    dev({ soil_pct: null, water_left_ml: null, battery_pct: null, last_seen_at: null, reading_ts: null }),
  );
  await open();
  await screen.findByText('No current reading');
  expect(screen.getAllByText('—')).toHaveLength(2);
});

test('a failed device load with no cache shows dashes, not "No module yet"', async () => {
  mocked(devices.fetchDevice).mockRejectedValue(new Error('x'));
  await open();
  await screen.findByText('No current reading', undefined, { timeout: 5000 });
  expect(screen.getAllByText('—')).toHaveLength(2);
  expect(screen.queryByText('No module yet')).toBeNull();
});

test('fault and tank are red, on the page and on the photo; offline is ink', async () => {
  mocked(devices.fetchDevice).mockResolvedValue(dev({ float_low: true }));
  await open();
  await screen.findByText('Watering is paused. It starts again by itself once you top it up.');
  expect(headline().color).toBe(colors.light.statusNow);
  expect(screen.getByTestId('hero-pills')).toHaveTextContent('Tank needs refilling', { exact: false });
  expect(screen.getByText('Nearly empty')).toBeTruthy();
  queryClient.clear();
  mocked(devices.fetchDevice).mockResolvedValue(dev({ last_seen_at: minsAgo(300) }));
  await open();
  await screen.findByText('It may be out of Wi-Fi range or its battery may be flat.');
  expect(headline().color).toBe(colors.light.label);
});

test('Resume watering inserts clear_fault, then waits for the module', async () => {
  const d = dev({ fault_code: 'no_moisture_rise' });
  mocked(devices.fetchDevice).mockResolvedValue(d);
  await open();
  await screen.findByText("Check the stake is in the soil and the tube isn't kinked, then resume.");
  mocked(devices.fetchDevice).mockResolvedValue({ ...d, resumePending: true });
  await press('Resume watering');
  expect(mocked(devices.resumeWatering).mock.calls[0][0]).toBe('d1');
  await screen.findByText('Waiting for the module…');
  expect(screen.queryByRole('button', { name: 'Resume watering' })).toBeNull();
});

test('a second press while resuming does not insert again', async () => {
  mocked(devices.fetchDevice).mockResolvedValue(dev({ fault_code: 'no_moisture_rise' }));
  mocked(devices.resumeWatering).mockReturnValue(new Promise(() => {}));
  await open();
  const button = await screen.findByRole('button', { name: 'Resume watering' });
  await fireEvent.press(button);
  expect(screen.getByRole('button', { name: 'Sending…' })).toBeTruthy();
  await fireEvent.press(button);
  expect(devices.resumeWatering).toHaveBeenCalledTimes(1);
});

test('a failed resume says so and the button comes back', async () => {
  mocked(devices.fetchDevice).mockResolvedValue(dev({ fault_code: 'no_moisture_rise' }));
  mocked(devices.resumeWatering).mockRejectedValue(new Error('x'));
  await open();
  await screen.findByRole('button', { name: 'Resume watering' });
  await press('Resume watering');
  expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't send that. Try again.");
  expect(screen.getByRole('button', { name: 'Resume watering' })).toBeTruthy();
});

test('an offline module shows no current tank reading, not its last value', async () => {
  mocked(devices.fetchDevice).mockResolvedValue(dev({ last_seen_at: minsAgo(300) }));
  await open();
  await screen.findByText('No current reading');
  expect(screen.queryByText('About 500 ml')).toBeNull();
});

test('sensor fault has no Resume button', async () => {
  mocked(devices.fetchDevice).mockResolvedValue(dev({ fault_code: 'sensor_fault' }));
  await open();
  await screen.findByText('Check the stake is pushed into the soil. It resumes by itself.');
  expect(screen.queryByRole('button', { name: 'Resume watering' })).toBeNull();
});

test('How watering works explains the limits in plain words', async () => {
  mocked(devices.fetchDevice).mockResolvedValue(dev());
  await open();
  await screen.findByText('About 500 ml');
  await press('How watering works');
  await screen.findByText('Fernando gets at most 40 ml at a time and 150 ml a day.');
  expect(screen.getByText('It never pumps when the tank is low.')).toBeTruthy();
});

test('Remove module asks first, then deletes the device and invalidates', async () => {
  mocked(devices.fetchDevice).mockResolvedValue(dev());
  await open();
  await screen.findByText('About 500 ml');
  await press('More options');
  await press('Remove module');
  expect(
    screen.getByText('Remove the module? Its history is deleted. The module forgets this account at its next check-in.'),
  ).toBeTruthy();
  await press('Cancel');
  expect(devices.removeDevice).not.toHaveBeenCalled();
  await press('Remove module');
  mocked(devices.fetchDevice).mockResolvedValue(null);
  await press('Remove');
  await waitFor(() => expect(devices.removeDevice).toHaveBeenCalled());
  expect(mocked(devices.removeDevice).mock.calls[0][0]).toBe('d1');
  await screen.findByText('No module yet');
});

test('the ⋯ menu offers Edit and Delete {name}, which asks first', async () => {
  mocked(api.deletePlant).mockResolvedValue(undefined);
  await open();
  await screen.findByText('Fernando');
  await press('More options');
  // The menu is modal for screen readers (escape closes it); the backdrop is for touch.
  await fireEvent.press(screen.getByLabelText('Close menu', { includeHiddenElements: true }));
  expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  await press('More options');
  await press('Edit');
  expect(mockPush).toHaveBeenCalledWith('/plant/p1/edit');
  await press('More options');
  await press('Delete Fernando');
  expect(screen.getByText('Delete Fernando and all its photos?')).toBeTruthy();
  await press('Cancel');
  expect(api.deletePlant).not.toHaveBeenCalled();
  await press('Delete Fernando');
  await press('Delete');
  await waitFor(() => expect(api.deletePlant).toHaveBeenCalledWith('p1'));
});

test('skeletons appear after 300 ms while loading, never a spinner', async () => {
  mocked(api.fetchPlant).mockReturnValue(new Promise(() => {}));
  await open();
  await waitFor(() => expect(screen.getByLabelText('Loading')).toBeTruthy());
  expect(screen.queryByText('No module yet')).toBeNull();
});

test('a failed load with no cache shows a dash, not a guessed value', async () => {
  mocked(api.fetchPlant).mockRejectedValue(new Error('x'));
  await open();
  await screen.findByText('—', undefined, { timeout: 5000 });
  expect(StyleSheet.flatten(screen.getByTestId('plant-hero').props.style).backgroundColor).toBe(colors.light.surface);
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
  await press('Check');
  expect(api.checkHealth).toHaveBeenCalledWith('p1', ['u/h1.jpg']);
  await screen.findByText('It looks healthy in this photo.');
  await press('Done');
  await screen.findByText('Fernando');
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

test('leaving while a check runs keeps the photos: the check puts them on the timeline', async () => {
  mocked(api.checkHealth).mockReturnValue(new Promise(() => {}));
  await open('/plant/p1');
  await screen.findByText('Fernando');
  await press('Check its health');
  await screen.findByText('Whole plant');
  await press('Take photo', 0);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Check' }).props.accessibilityState.disabled).toBe(false));
  await press('Check');
  await act(async () => router.back());
  await screen.findByText('Fernando');
  expect(photos.deletePhotos).not.toHaveBeenCalled();
});

test('a camera that rejects shows the failure copy instead of an unhandled rejection', async () => {
  mocked(ImagePicker.launchCameraAsync).mockRejectedValue(new Error('no camera'));
  await open('/plant/p1/health');
  await press('Take photo', 0);
  await screen.findByText("Couldn't add that photo. Try again.");
});

async function checkWith(result: object, photoCount = 1) {
  mocked(api.checkHealth).mockResolvedValue(result);
  let n = 0;
  mocked(photos.preparePhoto).mockImplementation(async () => ({ uri: `file:///p${++n}.jpg`, width: 1, height: 1, base64: 'AQID' }));
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

describe('timeline', () => {
  test('a failed load with nothing cached shows the section with "—", not an empty timeline', async () => {
    mocked(api.fetchPlantPhotos).mockRejectedValue(new Error('offline'));
    await open('/plant/p1');
    expect(await screen.findByText('Timeline', undefined, { timeout: 5000 })).toBeTruthy(); // after one retry
    expect(screen.getByLabelText('Timeline not loaded')).toBeTruthy();
  });

  const ph = (i: number, health: object | null = null) => ({
    id: `ph${i}`,
    path: `u/t${i}.jpg`,
    taken_at: `2026-11-${String(20 - i).padStart(2, '0')}T12:00:00Z`,
    scan_id: null,
    health,
  });
  const urls = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`u/t${i}.jpg`, `https://signed/t${i}.jpg`]));
  const short = { day: 'numeric', month: 'short' } as const;
  const withPhotos = (n: number) =>
    mocked(api.fetchPlantPhotos).mockResolvedValue({
      photos: Array.from({ length: n }, (_, i) => ph(i, i === 0 ? { healthy: false, note: 'n', advice: null } : null)),
      photoUrls: urls(n),
    });

  test('no photos: no strip and no See all, only Add a photo', async () => {
    await open();
    await screen.findByText('Fernando');
    expect(screen.queryByText('Timeline')).toBeNull();
    expect(screen.queryByText('See all')).toBeNull();
    expect(screen.getByRole('button', { name: 'Add a photo' })).toBeTruthy();
  });

  test('thumbnails run newest first with a date and a status dot only when checked', async () => {
    withPhotos(3);
    await open();
    await screen.findByText('Timeline');
    const d = new Date('2026-11-20T12:00:00Z');
    await screen.findByLabelText(`Photo from ${d.toLocaleDateString(undefined, { ...short, year: 'numeric' })}`);
    expect(screen.getAllByTestId('timeline-thumb').map((t) => t.props.source)).toEqual([
      [{ uri: 'https://signed/t0.jpg', cacheKey: 'u/t0.jpg' }],
      [{ uri: 'https://signed/t1.jpg', cacheKey: 'u/t1.jpg' }],
      [{ uri: 'https://signed/t2.jpg', cacheKey: 'u/t2.jpg' }],
    ]);
    expect(screen.getByText(d.toLocaleDateString(undefined, short))).toBeTruthy();
    expect(screen.getAllByTestId('timeline-dot')).toHaveLength(1);
  });

  test('See all opens the viewer at 0; a thumbnail opens it at its index', async () => {
    withPhotos(3);
    await open();
    await press('See all');
    expect(mockPush).toHaveBeenLastCalledWith('/plant/p1/photos?start=0');
    const thumbs = await screen.findAllByRole('button', { name: /^Photo from/ });
    await fireEvent.press(thumbs[2]);
    expect(mockPush).toHaveBeenLastCalledWith('/plant/p1/photos?start=2');
  });

  test('reaching the end loads the next page', async () => {
    mocked(api.fetchPlantPhotos).mockImplementation(async (_id: string, page: number) => ({
      photos: Array.from({ length: page === 0 ? api.PAGE_SIZE : 1 }, (_, i) => ph(page * 100 + i)),
      photoUrls: {},
    }));
    await open();
    await screen.findByText('Timeline');
    await fireEvent(screen.getByTestId('timeline-list'), 'endReached');
    await waitFor(() => expect(api.fetchPlantPhotos).toHaveBeenCalledWith('p1', 1));
  });

  async function addOne() {
    mocked(api.addPlantPhoto).mockResolvedValue('u/new.jpg');
    await open();
    await screen.findByText('Fernando');
    await press('Add a photo');
    await press('Take photo');
    await screen.findByText('Added to the timeline.');
  }

  test('Add a photo uploads it, then offers a check or Not now', async () => {
    await addOne();
    expect(api.addPlantPhoto).toHaveBeenCalledWith(expect.any(String), 'p1', { uri: 'file:///prepared.jpg', width: 1, height: 1, base64: 'AQID' });
    await press('Not now');
    expect(screen.queryByText('Added to the timeline.')).toBeNull();
    expect(api.checkHealth).not.toHaveBeenCalled();
  });

  test('a permission refusal shows the settings copy; an upload failure a short error', async () => {
    mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue({ granted: false });
    await open();
    await screen.findByText('Fernando');
    await press('Add a photo');
    await press('Take photo');
    await screen.findByText('Camera access is off. Allow it in Settings to take photos.');
    mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue({ granted: true });
    mocked(api.addPlantPhoto).mockRejectedValue(new Error('x'));
    await press('Take photo');
    await screen.findByText("Couldn't add that photo. Try again.");
    expect(screen.queryByText('Added to the timeline.')).toBeNull();
  });

  test('Check its health runs once even on a double tap, and the card shows progress', async () => {
    mocked(api.checkHealth).mockReturnValue(new Promise(() => {}));
    await addOne();
    const button = screen.getAllByRole('button', { name: 'Check its health' }).at(-1)!;
    await fireEvent.press(button);
    await fireEvent.press(button);
    expect(api.checkHealth).toHaveBeenCalledTimes(1);
    expect(api.checkHealth).toHaveBeenCalledWith('p1', ['u/new.jpg']);
    await screen.findByText('Looking at your plant…');
  });

  test('at the daily limit the limit copy shows and the photo stays', async () => {
    mocked(api.checkHealth).mockRejectedValue(new Error(LIMIT));
    await addOne();
    await fireEvent.press(screen.getAllByRole('button', { name: 'Check its health' }).at(-1)!);
    await screen.findByText(LIMIT);
    expect(photos.deletePhotos).not.toHaveBeenCalled();
  });
});
