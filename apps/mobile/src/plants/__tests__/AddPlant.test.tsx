import * as ImagePicker from 'expo-image-picker';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Linking } from 'react-native';

import { queryClient } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import * as api from '@/plants/api';
import * as photos from '@/plants/photos';
import { fakeSession } from '@/test-utils/supabaseMock';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories must be self-contained
jest.mock('@/lib/supabase', () => require('@/test-utils/supabaseMock'));
jest.mock('@/plants/api', () => ({
  ...jest.requireActual('@/plants/api'),
  identifyPlant: jest.fn(),
  createPlant: jest.fn(),
  checkHealth: jest.fn().mockResolvedValue({ healthy: true, note: 'ok', advice: null }),
  searchLocalSpecies: jest.fn(),
  searchPlantNames: jest.fn(),
  pickSpecies: jest.fn(),
}));
jest.mock('@/plants/photos', () => ({
  preparePhoto: jest.fn(),
  uploadPhoto: jest.fn(),
  deletePhotos: jest.fn().mockResolvedValue(undefined),
  signPhotoUrls: jest.fn().mockResolvedValue({}),
}));
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

// The plant detail route doesn't exist until Task 11: record pushes, then pass them through.
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => {
    const r = jest.requireActual('expo-router').useRouter();
    return { ...r, push: (href: string) => (mockPush(href), r.push(href)) };
  },
}));

const mocked = <T,>(f: T) => f as unknown as jest.Mock;
const auth = supabase.auth as unknown as Record<string, jest.Mock>;
const COULDNT = "Couldn't tell from this photo. Try one with a whole leaf in view, or search.";
const LIMIT =
  "You've reached the identification limit for now. Search for the plant type, or try again later.";
const monstera = { speciesId: 's1', commonName: 'Monstera', scientificName: 'Monstera deliciosa' };

let uploads = 0;
beforeEach(() => {
  jest.clearAllMocks();
  queryClient.clear();
  uploads = 0;
  mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue({ granted: true });
  mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({ granted: true });
  mocked(ImagePicker.launchCameraAsync).mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///raw.jpg' }] });
  mocked(photos.preparePhoto).mockResolvedValue({ uri: 'file:///prepared.jpg', width: 1, height: 1 });
  mocked(photos.uploadPhoto).mockImplementation(async () => `u/${++uploads}.jpg`);
  mocked(api.createPlant).mockResolvedValue({ id: 'new-plant' });
  mocked(api.searchLocalSpecies).mockResolvedValue([]);
  mocked(api.searchPlantNames).mockResolvedValue([]);
  auth.getSession.mockResolvedValue({ data: { session: fakeSession }, error: null });
});

async function open(url = '/add/plant') {
  const view = await renderRouter('src/app', { initialUrl: url });
  await waitFor(() => expect(screen.queryByTestId('launch')).toBeNull(), { timeout: 3000 });
  return view;
}
const press = (name: string | RegExp, i = 0) => fireEvent.press(screen.getAllByRole('button', { name })[i]);

/** Plant screen -> capture -> take cards' photos (by index) -> back on the plant screen. */
async function addPhotos(cardIndexes: number[]) {
  await press('Add photo');
  for (const i of cardIndexes) await press('Take photo', i);
  await waitFor(() => expect(photos.uploadPhoto).toHaveBeenCalledTimes(cardIndexes.length));
  await press('Done');
}

test('shows the title, heading and hint; Identify needs a whole-plant photo', async () => {
  await open();
  expect(screen.getByText('Which plant is this for?')).toBeTruthy();
  expect(
    screen.getByText(
      "Not sure what it is? Add a photo and we'll suggest a type. The type sets how damp the soil should stay.",
    ),
  ).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Identify' })).toBeNull();
  // A leaf alone is not enough.
  await addPhotos([1]);
  expect(screen.queryByRole('button', { name: 'Identify' })).toBeNull();
});

test('guided capture: three cards with copy; leaf and flower can be skipped', async () => {
  await open('/add/capture');
  for (const t of ['Whole plant', 'One leaf', 'Flower or problem spot'])
    expect(screen.getByText(t)).toBeTruthy();
  expect(screen.getByText('Step back so the whole plant and pot fit')).toBeTruthy();
  expect(screen.getAllByRole('button', { name: 'Skip' })).toHaveLength(2);
  expect(screen.getAllByRole('button', { name: 'Choose from library' })).toHaveLength(3);
});

test('uploads on capture, shows a thumbnail, Remove deletes the upload', async () => {
  await open('/add/capture');
  await press('Take photo', 0);
  await waitFor(() => expect(screen.getByLabelText('Whole plant photo')).toBeTruthy());
  expect(photos.preparePhoto).toHaveBeenCalledWith('file:///raw.jpg');
  await press('Remove');
  await waitFor(() => expect(photos.deletePhotos).toHaveBeenCalledWith(['u/1.jpg']));
  expect(screen.queryByLabelText('Whole plant photo')).toBeNull();
});

test('retaking deletes the replaced upload', async () => {
  await open('/add/capture');
  await press('Take photo', 0);
  await waitFor(() => expect(screen.getByLabelText('Whole plant photo')).toBeTruthy());
  await press('Take photo', 0);
  await waitFor(() => expect(photos.deletePhotos).toHaveBeenCalledWith(['u/1.jpg']));
});

test('denied camera permission shows an Open Settings row', async () => {
  mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue({ granted: false });
  const open$ = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
  await open('/add/capture');
  await press('Take photo', 0);
  await press('Open Settings');
  expect(open$).toHaveBeenCalled();
  expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
});

test('Identify is only called after tapping it, and shows words not percentages', async () => {
  mocked(api.identifyPlant).mockResolvedValue({
    scanId: 'scan1',
    isPlant: true,
    suggestions: [
      { ...monstera, confidence: 'very_likely' },
      { speciesId: 's2', commonName: 'Philodendron', scientificName: 'Philodendron hederaceum', confidence: 'likely' },
      { speciesId: 's3', commonName: 'Pothos', scientificName: 'Epipremnum aureum', confidence: 'possibly' },
    ],
  });
  await open();
  await addPhotos([0, 1]);
  expect(api.identifyPlant).not.toHaveBeenCalled();
  await press('Identify');
  await waitFor(() => expect(screen.getByText('Is it one of these?')).toBeTruthy());
  expect(api.identifyPlant).toHaveBeenCalledWith(['u/1.jpg', 'u/2.jpg']);
  for (const w of ['Very likely', 'Likely', 'Possibly']) expect(screen.getByText(new RegExp(w))).toBeTruthy();
  expect(screen.getByText(/Monstera deliciosa/)).toBeTruthy();
  expect(screen.queryByText(/%/)).toBeNull();
  expect(screen.getByRole('button', { name: 'Use Monstera' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'None of these, search instead' })).toBeTruthy();
});

test('top suggestion is not preselected unless very likely', async () => {
  mocked(api.identifyPlant).mockResolvedValue({
    scanId: 'scan1',
    isPlant: true,
    suggestions: [{ ...monstera, confidence: 'likely' }],
  });
  await open();
  await addPhotos([0]);
  await press('Identify');
  await waitFor(() => expect(screen.getByText('Is it one of these?')).toBeTruthy());
  expect(screen.queryByRole('button', { name: /^Use / })).toBeNull();
  await press(/^Monstera/);
  await press('Use Monstera');
  await waitFor(() => expect(screen.getByDisplayValue('Monstera')).toBeTruthy());
});

test('using a suggestion fills the type; Name is prefilled only when empty', async () => {
  mocked(api.identifyPlant).mockResolvedValue({
    scanId: 'scan1',
    isPlant: true,
    suggestions: [{ ...monstera, confidence: 'very_likely' }],
  });
  await open();
  await fireEvent.changeText(screen.getByLabelText('Name'), 'Fernando');
  await addPhotos([0]);
  await press('Identify');
  await press('Use Monstera');
  await waitFor(() => expect(screen.getByText('Monstera')).toBeTruthy()); // Plant type value
  expect(screen.getByDisplayValue('Fernando')).toBeTruthy();
  await press('Continue');
  await waitFor(() =>
    expect(api.createPlant).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Fernando', speciesId: 's1', scanId: 'scan1', photoPath: 'u/1.jpg' }),
    ),
  );
});

test.each([
  ['not a plant', () => mocked(api.identifyPlant).mockResolvedValue({ isPlant: false, suggestions: [] }), COULDNT],
  ['a failure', () => mocked(api.identifyPlant).mockRejectedValue(new Error('boom')), COULDNT],
  ['the limit', () => mocked(api.identifyPlant).mockRejectedValue(new Error(LIMIT)), LIMIT],
])('identify %s shows its message', async (_n, arrange, message) => {
  arrange();
  await open();
  await addPhotos([0]);
  await press('Identify');
  await waitFor(() => expect(screen.getByText(message)).toBeTruthy());
  expect(screen.getByRole('button', { name: 'Plant type' })).toBeTruthy();
});

test('Continue needs a name, then saves without a type or photo and opens the plant', async () => {
  await open();
  expect(screen.getByRole('button', { name: 'Continue' }).props.accessibilityState.disabled).toBe(true);
  await fireEvent.changeText(screen.getByLabelText('Name'), '  Fern  ');
  await fireEvent.changeText(screen.getByLabelText('Room'), ' Kitchen ');
  await press('Continue');
  await waitFor(() => expect(api.createPlant).toHaveBeenCalled());
  expect(mocked(api.createPlant).mock.calls[0][0]).toEqual({
    name: 'Fern',
    room: 'Kitchen',
    speciesId: undefined,
    customType: undefined,
    photoPath: undefined,
    scanId: undefined,
  });
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/plant/new-plant'));
});

test('Continue deletes a leaf photo that was never identified', async () => {
  await open();
  await fireEvent.changeText(screen.getByLabelText('Name'), 'Fern');
  await addPhotos([0, 1]);
  await press('Continue');
  await waitFor(() => expect(photos.deletePhotos).toHaveBeenCalledWith(['u/2.jpg']));
  expect(mocked(api.createPlant).mock.calls[0][0]).toMatchObject({ photoPath: 'u/1.jpg' });
  expect(api.checkHealth).not.toHaveBeenCalled();
});

test('a problem-spot photo starts a health check on Continue and is kept; navigation does not wait for it', async () => {
  mocked(api.checkHealth).mockReturnValue(new Promise(() => {}));
  await open();
  await fireEvent.changeText(screen.getByLabelText('Name'), 'Fern');
  await addPhotos([0, 1, 2]);
  await press('Continue');
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/plant/new-plant'));
  expect(api.checkHealth).toHaveBeenCalledWith('new-plant', ['u/1.jpg', 'u/3.jpg']);
  expect(photos.deletePhotos).toHaveBeenCalledWith(['u/2.jpg']);
  expect(photos.deletePhotos).not.toHaveBeenCalledWith(expect.arrayContaining(['u/3.jpg']));
});

test('a problem-spot photo without a whole-plant photo runs no check and is deleted', async () => {
  await open();
  await fireEvent.changeText(screen.getByLabelText('Name'), 'Fern');
  await addPhotos([2]);
  await press('Continue');
  await waitFor(() => expect(photos.deletePhotos).toHaveBeenCalledWith(['u/1.jpg']));
  expect(api.checkHealth).not.toHaveBeenCalled();
});

test('Cancel deletes every uploaded photo and saves nothing', async () => {
  const view = await open();
  await addPhotos([0, 1]);
  await press('Cancel');
  await waitFor(() => expect(photos.deletePhotos).toHaveBeenCalledWith(['u/1.jpg', 'u/2.jpg']));
  expect(api.createPlant).not.toHaveBeenCalled();
  await waitFor(() => expect(view.getPathname()).toBe('/'));
});

describe('plant type search', () => {
  const local = { id: 'l1', scientific_name: 'Ficus lyrata', common_names: ['Fiddle-leaf fig'] };
  const type = (t: string) => fireEvent.changeText(screen.getByLabelText('Search plants'), t);

  test('local results read "Common name — Scientific name"; picking one sets the type', async () => {
    mocked(api.searchLocalSpecies).mockResolvedValue([local]);
    await open();
    await press('Plant type');
    await type('fid');
    await waitFor(() => expect(screen.getByText('Fiddle-leaf fig — Ficus lyrata')).toBeTruthy());
    await press(/Fiddle-leaf fig/);
    await waitFor(() => expect(screen.getByText('Fiddle-leaf fig')).toBeTruthy());
  });

  test('few local matches add More plants; picking one stores it first', async () => {
    mocked(api.searchPlantNames).mockResolvedValue([{ commonName: 'Calathea', scientificName: 'Goeppertia ornata' }]);
    mocked(api.pickSpecies).mockResolvedValue('new-species');
    await open();
    await press('Plant type');
    await type('cal');
    await waitFor(() => expect(screen.getByText('More plants')).toBeTruthy());
    await press(/Calathea — Goeppertia ornata/);
    await waitFor(() => expect(api.pickSpecies).toHaveBeenCalledWith('Goeppertia ornata'));
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Cal');
    await press('Continue');
    await waitFor(() =>
      expect(api.createPlant).toHaveBeenCalledWith(expect.objectContaining({ speciesId: 'new-species' })),
    );
  });

  test('nothing matching offers a custom type', async () => {
    await open();
    await press('Plant type');
    await type('Zorb');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Use “Zorb” as the type' })).toBeTruthy());
    await press('Use “Zorb” as the type');
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Z');
    await press('Continue');
    await waitFor(() =>
      expect(api.createPlant).toHaveBeenCalledWith(expect.objectContaining({ customType: 'Zorb' })),
    );
  });
});
