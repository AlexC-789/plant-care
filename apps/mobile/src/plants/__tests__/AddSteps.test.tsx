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
    mocked(api.identifyPlant).mockResolvedValue({
      scanId: 'scan1',
      isPlant: true,
      suggestions: [{ speciesId: 's1', commonName: 'Monstera', scientificName: 'Monstera deliciosa', confidence: 'likely' }],
    });
    // The old single-screen add stands in for step 2 until Task 3.
    await open('/add/plant');
    await press('Add photos');
    await press('Take photo', 0);
    await waitFor(() => expect(photos.uploadPhoto).toHaveBeenCalledTimes(1));
    await press('Done');
    await press('Identify');
    await waitFor(() => expect(screen.getByText('Monstera')).toBeTruthy());
    await act(async () => router.push('/add/photo'));
    await waitFor(() => expect(screen.getByText('Take a photo of your plant')).toBeTruthy());
    await press('Take photo', 0);
    await waitFor(() => expect(photos.uploadPhoto).toHaveBeenCalledTimes(2));
    await act(async () => router.back());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Identify' })).toBeTruthy());
    expect(screen.queryByText('Monstera')).toBeNull();
  });
});
