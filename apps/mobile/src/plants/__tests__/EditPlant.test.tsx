import * as ImagePicker from 'expo-image-picker';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

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
  updatePlant: jest.fn(),
  searchLocalSpecies: jest.fn(),
  searchPlantNames: jest.fn(),
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

const mocked = <T,>(f: T) => f as unknown as jest.Mock;
const auth = supabase.auth as unknown as Record<string, jest.Mock>;
const monstera = { id: 's1', common_names: ['Monstera'], scientific_name: 'Monstera deliciosa', description: null, light: null, watering: null };
const pothos = { id: 's2', common_names: ['Pothos'], scientific_name: 'Epipremnum aureum' };
const fern = { id: 'p1', name: 'Fernando', room: 'Kitchen', species_id: 's1', custom_type: null, photo_path: 'u/p.jpg' };

beforeEach(() => {
  jest.clearAllMocks();
  queryClient.clear();
  mocked(api.fetchPlant).mockResolvedValue(fern);
  mocked(api.fetchSpecies).mockResolvedValue(monstera);
  mocked(api.fetchLatestHealth).mockResolvedValue(null);
  mocked(api.updatePlant).mockImplementation(async (_id: string, patch: object) => ({ ...fern, ...patch }));
  mocked(api.searchLocalSpecies).mockResolvedValue([pothos]);
  mocked(api.searchPlantNames).mockResolvedValue([]);
  mocked(photos.signPhotoUrls).mockImplementation(async (ps: string[]) => Object.fromEntries(ps.map((p) => [p, `https://signed/${p}`])));
  mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue({ granted: true });
  mocked(ImagePicker.launchCameraAsync).mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///raw.jpg' }] });
  mocked(photos.preparePhoto).mockResolvedValue({ uri: 'file:///prepared.jpg', width: 1, height: 1 });
  mocked(photos.uploadPhoto).mockResolvedValue('u/new.jpg');
  auth.getSession.mockResolvedValue({ data: { session: fakeSession }, error: null });
});

async function open() {
  const view = await renderRouter('src/app', { initialUrl: '/plant/p1/edit' });
  await waitFor(() => expect(screen.queryByTestId('launch')).toBeNull(), { timeout: 3000 });
  await screen.findByDisplayValue('Fernando');
  return view;
}
const press = async (name: string | RegExp, i = 0) => fireEvent.press(screen.getAllByRole('button', { name })[i]);

test('prefills name and room; Done saves the edited name and room', async () => {
  await open();
  expect(screen.getByDisplayValue('Kitchen')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Name'), '  Ferdinand ');
  await fireEvent.changeText(screen.getByLabelText('Room'), '');
  await press('Done');
  await waitFor(() =>
    expect(api.updatePlant).toHaveBeenCalledWith('p1', expect.objectContaining({ name: 'Ferdinand', room: null })),
  );
  expect(photos.deletePhotos).not.toHaveBeenCalled();
});

test('an empty name blocks Done', async () => {
  await open();
  await fireEvent.changeText(screen.getByLabelText('Name'), '   ');
  await press('Done');
  expect(api.updatePlant).not.toHaveBeenCalled();
  expect(screen.getByText('Give it a name (up to 60 characters).')).toBeTruthy();
});

test('picking a new type keeps the typed name and saves species_id', async () => {
  await open();
  await fireEvent.changeText(screen.getByLabelText('Name'), 'Ferdinand');
  await press('Plant type');
  await fireEvent.changeText(await screen.findByLabelText('Search plants'), 'poth');
  await fireEvent.press(await screen.findByText('Pothos — Epipremnum aureum', undefined, { timeout: 3000 }));
  expect(await screen.findByDisplayValue('Ferdinand')).toBeTruthy();
  expect(screen.getByText('Pothos')).toBeTruthy();
  await press('Done');
  await waitFor(() =>
    expect(api.updatePlant).toHaveBeenCalledWith('p1', expect.objectContaining({ species_id: 's2', custom_type: null })),
  );
});

test('the photo lives on the timeline: Edit has no photo controls', async () => {
  await open();
  expect(screen.queryByRole('button', { name: 'Take photo' })).toBeNull();
  expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull();
  expect(screen.queryByLabelText('Fernando photo')).toBeNull();
});

test('Delete asks first (copy, Cancel keeps it), then deletes row + all photos and returns to Plants', async () => {
  const rows: Record<string, unknown> = {
    plants: { photo_path: 'u/p.jpg' },
    scans: [{ photo_paths: ['u/s1.jpg'] }, { photo_paths: ['u/s2.jpg'] }],
    plant_photos: [{ path: 'u/p.jpg' }, { path: 'u/t1.jpg' }],
  };
  const calls: string[] = [];
  mocked(supabase.from).mockImplementation((table: string) => {
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'delete']) b[m] = (...a: unknown[]) => (calls.push(`${table}.${m}`), a, b);
    b.single = async () => ({ data: rows[table], error: null });
    b.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: rows[table], error: null }).then(res);
    return b;
  });
  await open();
  await press('Delete plant');
  expect(screen.getByText("Delete Fernando? Its photos are deleted too. This can't be undone.")).toBeTruthy();
  await press('Cancel');
  expect(screen.queryByText(/Its photos are deleted too/)).toBeNull();
  await press('Delete plant');
  await press('Delete');
  await waitFor(() =>
    expect(photos.deletePhotos).toHaveBeenCalledWith(['u/p.jpg', 'u/s1.jpg', 'u/s2.jpg', 'u/t1.jpg']),
  );
  expect(calls).toContain('plants.delete');
  await waitFor(() => expect(screen).toHavePathname('/'));
});

test('the form scrolls clear of the keyboard', async () => {
  await open();
  // The screen's scroll view is the nearest ancestor of the Room field that sets the prop.
  let scroll = screen.getByLabelText('Room').parent;
  while (scroll && scroll.props.automaticallyAdjustKeyboardInsets === undefined) scroll = scroll.parent;
  expect(scroll?.props.automaticallyAdjustKeyboardInsets).toBe(true);
  expect(scroll?.props.keyboardShouldPersistTaps).toBe('handled');
});
