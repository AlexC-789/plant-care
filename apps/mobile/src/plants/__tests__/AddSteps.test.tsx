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
  identifyPlant: jest.fn(),
  createPlant: jest.fn(),
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

// Steps 2-5 don't exist yet: record pushes, then pass them through.
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
const continueBtn = () => screen.getByRole('button', { name: 'Continue' });

let uploads = 0;
beforeEach(() => {
  jest.clearAllMocks();
  queryClient.clear();
  uploads = 0;
  mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue({ granted: true });
  mocked(ImagePicker.launchCameraAsync).mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///raw.jpg' }] });
  mocked(photos.preparePhoto).mockResolvedValue({ uri: 'file:///prepared.jpg', width: 1, height: 1 });
  mocked(photos.uploadPhoto).mockImplementation(async () => `u/${++uploads}.jpg`);
  mocked(api.searchLocalSpecies).mockResolvedValue([]);
  mocked(api.searchPlantNames).mockResolvedValue([]);
  auth.getSession.mockResolvedValue({ data: { session: fakeSession }, error: null });
});

async function open(url = '/add/photo') {
  await renderRouter('src/app', { initialUrl: url });
  await waitFor(() => expect(screen.queryByTestId('launch')).toBeNull(), { timeout: 3000 });
}
const press = (name: string | RegExp, i = 0) => fireEvent.press(screen.getAllByRole('button', { name })[i]);
const takeWhole = async () => {
  await press('Take photo', 0);
  await waitFor(() => expect(screen.getByText('Got it.')).toBeTruthy());
};

describe('step 1: photo', () => {
  test('the + opens it with the prompt and Step 1 of 4', async () => {
    await open('/');
    await fireEvent.press(screen.getByLabelText('Add a pot'));
    await waitFor(() => expect(screen.getByText('Take a photo of your plant')).toBeTruthy());
    expect(screen.getByRole('progressbar', { name: 'Step 1 of 4' })).toBeTruthy();
  });

  test('Continue waits for the whole-plant photo, then shows Got it. with that photo', async () => {
    await open();
    expect(continueBtn().props.accessibilityState?.disabled).toBe(true);
    expect(screen.queryByText('Got it.')).toBeNull();
    await takeWhole();
    expect(screen.getByLabelText('Your plant')).toBeTruthy();
    expect(continueBtn().props.accessibilityState?.disabled).toBeFalsy();
  });

  test('only the three optional cards can be skipped', async () => {
    await open();
    expect(screen.getAllByRole('button', { name: 'Skip' })).toHaveLength(3);
    expect(screen.getAllByRole('header').map((h) => h.props.children).flat()).toEqual(
      expect.arrayContaining(['Whole plant', 'One leaf', 'Flower', 'Problem spot']),
    );
  });

  test('Continue goes to step 2', async () => {
    await open();
    await takeWhole();
    await fireEvent.press(continueBtn());
    expect(mockPush).toHaveBeenCalledWith('/add/identify');
  });

  test('Cancel deletes every upload and closes', async () => {
    await open();
    await takeWhole();
    await fireEvent.press(screen.getByText('Cancel'));
    expect(photos.deletePhotos).toHaveBeenCalledWith(['u/1.jpg']);
    await waitFor(() => expect(screen.queryByText('Take a photo of your plant')).toBeNull());
  });

  test('changing photos after an identify clears the result', async () => {
    mocked(api.identifyPlant).mockResolvedValue(result([sugg('likely')]));
    await toIdentify();
    await press('Identify from my photo');
    await waitFor(() => expect(screen.getByText('Monstera')).toBeTruthy());
    await act(async () => router.back());
    await waitFor(() => expect(screen.getByText('Take a photo of your plant')).toBeTruthy());
    await press('Take photo', 0);
    await waitFor(() => expect(photos.uploadPhoto).toHaveBeenCalledTimes(2));
    await act(async () => router.push('/add/identify'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Identify from my photo' })).toBeTruthy());
    expect(screen.queryByText('Monstera')).toBeNull();
  });
});

const sugg = (confidence: api.Confidence, id = 's1', commonName = 'Monstera') => ({
  speciesId: id,
  commonName,
  scientificName: `${commonName} sci`,
  confidence,
});
const result = (suggestions: ReturnType<typeof sugg>[]) => ({ scanId: 'scan1', isPlant: true, suggestions });
const toIdentify = async () => {
  await open();
  await takeWhole();
  await fireEvent.press(continueBtn());
  await waitFor(() => expect(screen.getByText('What kind of plant is it?')).toBeTruthy());
};
const COULDNT = "Couldn't tell from this photo. Try one with a whole leaf in view, or search.";
const LIMIT = "You've reached the identification limit for now. Search for the plant type, or try again later.";

describe('step 2: what is it', () => {
  test('shows Step 2 of 4, the three actions and an enabled Continue', async () => {
    await toIdentify();
    expect(screen.getByRole('progressbar', { name: 'Step 2 of 4' })).toBeTruthy();
    for (const name of ['Identify from my photo', 'I know it — search', 'Skip']) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
    expect(continueBtn().props.accessibilityState?.disabled).toBeFalsy();
  });

  test('identify sends whole, leaf and flower but never the problem photo', async () => {
    mocked(api.identifyPlant).mockResolvedValue(result([sugg('likely')]));
    await open();
    await takeWhole(); // u/1
    await press('Take photo', 1); // leaf u/2
    await waitFor(() => expect(photos.uploadPhoto).toHaveBeenCalledTimes(2));
    await press('Take photo', 3); // problem u/3
    await waitFor(() => expect(photos.uploadPhoto).toHaveBeenCalledTimes(3));
    await fireEvent.press(continueBtn());
    await press('Identify from my photo');
    await waitFor(() => expect(api.identifyPlant).toHaveBeenCalledWith(['u/1.jpg', 'u/2.jpg']));
  });

  test('a Very likely top suggestion is applied at once; another one switches', async () => {
    mocked(api.identifyPlant).mockResolvedValue(
      result([sugg('very_likely', 's1', 'Moth orchid'), sugg('likely', 's2', 'Monstera')]),
    );
    await toIdentify();
    await press('Identify from my photo');
    await waitFor(() => expect(screen.getByText("It's a Moth orchid.")).toBeTruthy());
    expect(screen.getByText('Moth orchid sci')).toBeTruthy();
    await press(/^Monstera/);
    await waitFor(() => expect(screen.getByText("It's a Monstera.")).toBeTruthy());
    expect(screen.queryByText("It's a Moth orchid.")).toBeNull();
  });

  test('a lesser top suggestion waits for a tap', async () => {
    mocked(api.identifyPlant).mockResolvedValue(result([sugg('likely')]));
    await toIdentify();
    await press('Identify from my photo');
    await waitFor(() => expect(screen.getByText('Is it one of these?')).toBeTruthy());
    expect(screen.queryByText("It's a Monstera.")).toBeNull();
  });

  test('a search pick keeps the scan and shows the success line', async () => {
    mocked(api.identifyPlant).mockResolvedValue(result([sugg('likely')]));
    mocked(api.searchLocalSpecies).mockResolvedValue([
      { id: 'l1', scientific_name: 'Ficus lyrata', common_names: ['Fiddle-leaf fig'] },
    ] as never);
    await toIdentify();
    await press('Identify from my photo');
    await waitFor(() => expect(screen.getByText('Is it one of these?')).toBeTruthy());
    await press('I know it — search');
    await fireEvent.changeText(await screen.findByLabelText('Search plants'), 'fid');
    await waitFor(() => expect(screen.getByRole('button', { name: /Fiddle-leaf fig/ })).toBeTruthy());
    await press(/Fiddle-leaf fig/);
    await waitFor(() => expect(screen.getByText("It's a Fiddle-leaf fig.")).toBeTruthy());
    expect(screen.getByText('Ficus lyrata')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Monstera/ })).toBeTruthy(); // scan's suggestions still there
  });

  test('a names-only pick falls back to the scientific name when it has no common name', async () => {
    mocked(api.searchPlantNames).mockResolvedValue([{ commonName: '', scientificName: 'Goeppertia ornata' }]);
    mocked(api.pickSpecies).mockResolvedValue('new-species');
    await toIdentify();
    await press('I know it — search');
    await fireEvent.changeText(await screen.findByLabelText('Search plants'), 'goe');
    await waitFor(() => expect(screen.getByRole('button', { name: /Goeppertia ornata/ })).toBeTruthy());
    await press(/Goeppertia ornata/);
    await waitFor(() => expect(screen.getByText("It's a Goeppertia ornata.")).toBeTruthy());
  });

  test('a custom type reads "It\'s a {type}." with no scientific line', async () => {
    await toIdentify();
    await press('I know it — search');
    await fireEvent.changeText(await screen.findByLabelText('Search plants'), 'Zorb');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Use “Zorb” as the type' })).toBeTruthy());
    await press('Use “Zorb” as the type');
    await waitFor(() => expect(screen.getByText("It's a Zorb.")).toBeTruthy());
    expect(screen.queryByText(/sci/)).toBeNull();
  });

  test.each([
    ['fails', () => mocked(api.identifyPlant).mockRejectedValue(new Error('boom')), COULDNT],
    ['finds no plant', () => mocked(api.identifyPlant).mockResolvedValue({ isPlant: false, suggestions: [] }), COULDNT],
    ['is rate limited', () => mocked(api.identifyPlant).mockRejectedValue(new Error(LIMIT)), LIMIT],
  ])('when identify %s, the copy shows and search, Skip and Continue stay available', async (_n, arrange, copy) => {
    arrange();
    await toIdentify();
    await press('Identify from my photo');
    await waitFor(() => expect(screen.getByText(copy)).toBeTruthy());
    expect(screen.getByRole('button', { name: 'I know it — search' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeTruthy();
    expect(continueBtn().props.accessibilityState?.disabled).toBeFalsy();
  });

  test('Skip says it can be set later; Continue goes to step 3', async () => {
    await toIdentify();
    await press('Skip');
    expect(screen.getByText('Not sure? You can set it later.')).toBeTruthy();
    await fireEvent.press(continueBtn());
    expect(mockPush).toHaveBeenCalledWith('/add/where');
  });
});
