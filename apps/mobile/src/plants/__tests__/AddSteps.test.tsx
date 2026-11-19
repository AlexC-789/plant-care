import * as ImagePicker from 'expo-image-picker';
import { AccessibilityInfo, BackHandler, Linking, Platform, StyleSheet } from 'react-native';
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
  fetchPlantsPage: jest.fn(),
  fetchSpecies: jest.fn(),
  searchLocalSpecies: jest.fn(),
  searchPlantNames: jest.fn(),
  pickSpecies: jest.fn(),
  checkHealth: jest.fn(),
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
const mockTake = jest.fn();
const mockRequest = jest.fn();
let mockPermission: { status: string; granted: boolean } | null = null;
jest.mock('expo-camera', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return {
    CameraView: React.forwardRef(function CameraView(_p: object, ref: unknown) {
      React.useImperativeHandle(ref, () => ({ takePictureAsync: mockTake }));
      return React.createElement(View, { testID: 'camera' });
    }),
    useCameraPermissions: () => [mockPermission, mockRequest],
  };
});

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockDismissTo = jest.fn();
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => {
    const r = jest.requireActual('expo-router').useRouter();
    return {
      ...r,
      push: (href: string) => (mockPush(href), r.push(href)),
      replace: (href: string) => (mockReplace(href), r.replace(href)),
      dismissTo: (href: string) => (mockDismissTo(href), r.dismissTo(href)),
    };
  },
}));

const mocked = <T,>(f: T) => f as unknown as jest.Mock;
const auth = supabase.auth as unknown as Record<string, jest.Mock>;
const btn = (name: string | RegExp, i = 0) => screen.getAllByRole('button', { name })[i];
const press = (name: string | RegExp, i = 0) => fireEvent.press(btn(name, i));
const disabled = (name: string | RegExp) => !!btn(name).props.accessibilityState?.disabled;

const sugg = (confidence: api.Confidence, id = 's1', commonName = 'Moth orchid') => ({
  speciesId: id,
  commonName,
  scientificName: `${commonName} sci`,
  confidence,
});
const result = (suggestions: ReturnType<typeof sugg>[]) => ({ scanId: 'scan1', isPlant: true, suggestions });
const CARE = 'Likes bright, indirect light.';

let uploads = 0;
beforeEach(() => {
  jest.clearAllMocks();
  queryClient.clear();
  uploads = 0;
  mockPermission = { status: 'granted', granted: true };
  mockTake.mockResolvedValue({ uri: 'file:///shot.jpg' });
  mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({ granted: true });
  mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///raw.jpg' }] });
  mocked(photos.preparePhoto).mockResolvedValue({ uri: 'file:///prepared.jpg', width: 1, height: 1, base64: 'AQID' });
  mocked(photos.uploadPhoto).mockImplementation(async () => `u/${++uploads}.jpg`);
  mocked(api.identifyPlant).mockResolvedValue(result([sugg('very_likely'), sugg('likely', 's2', 'Monstera')]));
  mocked(api.fetchSpecies).mockResolvedValue({ id: 's1', description: CARE } as never);
  mocked(api.fetchPlantsPage).mockResolvedValue({ plants: [{ room: 'Office' }, { room: 'Kitchen' }, { room: null }], photoUrls: {} } as never);
  mocked(api.searchLocalSpecies).mockResolvedValue([]);
  mocked(api.searchPlantNames).mockResolvedValue([]);
  auth.getSession.mockResolvedValue({ data: { session: fakeSession }, error: null });
});

async function open(url = '/add/capture') {
  await renderRouter('src/app', { initialUrl: url });
  await waitFor(() => expect(screen.queryByTestId('launch')).toBeNull(), { timeout: 3000 });
}
/** Takes a photo and waits for the result screen to show its top match. */
const shoot = async (name = 'Moth orchid') => {
  await press('Take photo');
  await waitFor(() => expect(screen.getByRole('header', { name })).toBeTruthy());
};

describe('capture', () => {
  test('the + opens the camera with its instruction, Photos and the shutter', async () => {
    await open('/');
    await fireEvent.press(screen.getByLabelText('Add a plant'));
    await waitFor(() => expect(screen.getByText('Fit the whole plant in the frame')).toBeTruthy());
    expect(screen.getByTestId('camera')).toBeTruthy();
    for (const name of ['Close', 'Tips', 'Photos', 'Take photo']) expect(btn(name)).toBeTruthy();
  });

  test('a photo is re-encoded, uploaded and identified, then the result shows', async () => {
    await open();
    await shoot();
    expect(photos.preparePhoto).toHaveBeenCalledWith('file:///shot.jpg');
    expect(photos.uploadPhoto).toHaveBeenCalledWith(fakeSession.user.id, expect.objectContaining({ uri: 'file:///prepared.jpg' }));
    expect(mockPush).toHaveBeenCalledWith('/add/identify');
    expect(api.identifyPlant).toHaveBeenCalledWith(['u/1.jpg']);
  });

  test('Photos picks from the library, re-encoded the same way', async () => {
    await open();
    await press('Photos');
    await waitFor(() => expect(screen.getByText('Moth orchid')).toBeTruthy());
    expect(photos.preparePhoto).toHaveBeenCalledWith('file:///raw.jpg');
    expect(api.identifyPlant).toHaveBeenCalledWith(['u/1.jpg']);
  });

  test('a retake deletes the replaced upload and identifies the new one', async () => {
    await open();
    await shoot();
    await press('Back');
    await waitFor(() => expect(screen.getByText('Fit the whole plant in the frame')).toBeTruthy());
    mocked(api.identifyPlant).mockResolvedValue(result([sugg('very_likely', 's2', 'Monstera')]));
    await shoot('Monstera');
    expect(photos.deletePhotos).toHaveBeenCalledWith(['u/1.jpg']);
    expect(api.identifyPlant).toHaveBeenLastCalledWith(['u/2.jpg']);
    expect(screen.queryByText('Moth orchid')).toBeNull();
  });

  test('Close deletes the upload and closes the flow', async () => {
    await open();
    await shoot();
    await press('Back');
    await waitFor(() => expect(screen.getByText('Fit the whole plant in the frame')).toBeTruthy());
    await press('Close');
    expect(photos.deletePhotos).toHaveBeenCalledWith(['u/1.jpg']);
    await waitFor(() => expect(screen.queryByText('Fit the whole plant in the frame')).toBeNull());
  });

  test('Close with nothing taken deletes nothing', async () => {
    await open();
    await press('Close');
    expect(photos.deletePhotos).not.toHaveBeenCalled();
  });

  test('an unanswered permission is asked for once', async () => {
    mockPermission = { status: 'undetermined', granted: false };
    await open();
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  test('camera denied: the reason, Open Settings and Choose a photo instead', async () => {
    mockPermission = { status: 'denied', granted: false };
    const settings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    await open();
    expect(screen.getByText('Plant Care needs the camera to see your plant.')).toBeTruthy();
    expect(screen.queryByTestId('camera')).toBeNull();
    await press('Open Settings');
    expect(settings).toHaveBeenCalled();
    await press('Choose a photo instead');
    await waitFor(() => expect(screen.getByText('Moth orchid')).toBeTruthy());
    settings.mockRestore();
  });

  test('a failed upload shows the error and the shutter works again', async () => {
    mocked(photos.uploadPhoto).mockRejectedValueOnce(new Error('offline'));
    await open();
    await press('Take photo');
    await waitFor(() => expect(screen.getByText("Couldn't use that photo. Try again.")).toBeTruthy());
    expect(mockPush).not.toHaveBeenCalled();
    await shoot();
  });

  test('two taps on the shutter upload one photo', async () => {
    await open();
    const shutter = btn('Take photo');
    const click = () => shutter.props.onClick({ stopPropagation() {}, nativeEvent: {} });
    await act(async () => {
      click();
      click();
    });
    await waitFor(() => expect(screen.getByText('Moth orchid')).toBeTruthy());
    expect(photos.uploadPhoto).toHaveBeenCalledTimes(1);
  });

  test('Tips shows the three tips', async () => {
    await open();
    await press('Tips');
    expect(screen.getByText('Stand back so the whole plant fits, pot included.')).toBeTruthy();
    expect(screen.getByText('Daylight works best.')).toBeTruthy();
    expect(screen.getByText('One plant per photo.')).toBeTruthy();
  });
});

const COULDNT = "Couldn't tell what this is.";
const SERVER_LIMIT = "You've reached the identification limit for now. Search for the plant type, or try again later.";
const LIMIT = "You've reached today's limit for identifying plants. Try again tomorrow, or search by name.";

describe('result', () => {
  test('confidence in words, the name, the Latin name and a care line', async () => {
    await open();
    await shoot();
    expect(screen.getByText('Very likely')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Moth orchid' })).toBeTruthy();
    expect(screen.getByText('Moth orchid sci')).toBeTruthy();
    await waitFor(() => expect(screen.getByText(CARE)).toBeTruthy());
    expect(screen.getByLabelText('Your plant')).toBeTruthy();
    expect(api.identifyPlant).toHaveBeenCalledTimes(1);
  });

  test('while identifying, This is my plant waits', async () => {
    mocked(api.identifyPlant).mockReturnValue(new Promise(() => {}));
    await open();
    await press('Take photo');
    await waitFor(() => expect(btn('This is my plant')).toBeTruthy());
    expect(disabled('This is my plant')).toBe(true);
  });

  test('This is my plant goes to Name and place with its name filled in', async () => {
    await open();
    await shoot();
    await press('This is my plant');
    expect(mockPush).toHaveBeenCalledWith('/add/where');
    await waitFor(() => expect(screen.getByText('Name and place')).toBeTruthy());
    expect(screen.getByLabelText('Name').props.value).toBe('Moth orchid');
  });

  test("It's something else lists the others; picking one makes it the result", async () => {
    await open();
    await shoot();
    expect(screen.queryByText('Is it one of these?')).toBeNull();
    await press("It's something else");
    expect(screen.getByText('Is it one of these?')).toBeTruthy();
    await press(/^Monstera/);
    await waitFor(() => expect(screen.getByRole('header', { name: 'Monstera' })).toBeTruthy());
    expect(screen.getByText('Probably')).toBeTruthy();
  });

  test('a weak match says Might be and lists the others at once', async () => {
    mocked(api.identifyPlant).mockResolvedValue(result([sugg('possibly'), sugg('possibly', 's2', 'Monstera')]));
    await open();
    await shoot();
    expect(screen.getAllByText('Might be').length).toBeGreaterThan(0);
    expect(screen.getByText('Is it one of these?')).toBeTruthy();
  });

  test.each([
    ['fails', () => mocked(api.identifyPlant).mockRejectedValue(new Error('boom')), COULDNT],
    ['finds no plant', () => mocked(api.identifyPlant).mockResolvedValue({ isPlant: false, suggestions: [] }), COULDNT],
    ['is rate limited', () => mocked(api.identifyPlant).mockRejectedValue(new Error(SERVER_LIMIT)), LIMIT],
  ])('when identify %s: the copy, Try another photo and Search by name', async (_n, arrange, copy) => {
    arrange();
    await open();
    await press('Take photo');
    await waitFor(() => expect(screen.getByText(copy)).toBeTruthy());
    expect(btn('Search by name')).toBeTruthy();
    await press('Try another photo');
    await waitFor(() => expect(screen.getByText('Fit the whole plant in the frame')).toBeTruthy());
  });

  test('a search pick becomes the result, without a confidence word', async () => {
    mocked(api.searchLocalSpecies).mockResolvedValue([
      { id: 'l1', scientific_name: 'Ficus lyrata', common_names: ['Fiddle-leaf fig'] },
    ] as never);
    await open();
    await shoot();
    await press("It's something else");
    await press('Search by name');
    await fireEvent.changeText(await screen.findByLabelText('Search plants'), 'fid');
    await waitFor(() => expect(btn(/Fiddle-leaf fig/)).toBeTruthy());
    await press(/Fiddle-leaf fig/);
    await waitFor(() => expect(screen.getByRole('header', { name: 'Fiddle-leaf fig' })).toBeTruthy());
    expect(screen.getByText('Ficus lyrata')).toBeTruthy();
    expect(screen.queryByText('Very likely')).toBeNull();
    expect(api.identifyPlant).toHaveBeenCalledTimes(1);
  });

  test('a custom type from search can be saved as the plant', async () => {
    mocked(api.identifyPlant).mockResolvedValue({ isPlant: false, suggestions: [] });
    await open();
    await press('Take photo');
    await waitFor(() => expect(screen.getByText(COULDNT)).toBeTruthy());
    await press('Search by name');
    await fireEvent.changeText(await screen.findByLabelText('Search plants'), 'Zorb');
    await waitFor(() => expect(btn('Use “Zorb” as the type')).toBeTruthy());
    await press('Use “Zorb” as the type');
    await waitFor(() => expect(screen.getByRole('header', { name: 'Zorb' })).toBeTruthy());
    expect(screen.queryByText(/sci/)).toBeNull();
  });
});

const plant = { id: 'p1', name: 'x' };
const toWhere = async () => {
  await open();
  await shoot();
  await press('This is my plant');
  await waitFor(() => expect(screen.getByText('Name and place')).toBeTruthy());
};
const lastSaved = () => mocked(api.createPlant).mock.calls[0][0];
const save = () => screen.getAllByRole('button', { name: /^Save/ })[0];

describe('name and place', () => {
  beforeEach(() => mocked(api.createPlant).mockResolvedValue(plant as never));

  test('Step 2 of 3, the name selected for typing, limits and keyboard props', async () => {
    await toWhere();
    expect(screen.getByRole('progressbar', { name: 'Step 2 of 3' })).toBeTruthy();
    const name = screen.getByLabelText('Name');
    expect(name.props.maxLength).toBe(40);
    expect(name.props.selectTextOnFocus).toBe(true);
    let scroll = name.parent;
    while (scroll && scroll.props.automaticallyAdjustKeyboardInsets === undefined) scroll = scroll.parent;
    expect(scroll?.props.automaticallyAdjustKeyboardInsets).toBe(true);
    expect(scroll?.props.keyboardShouldPersistTaps).toBe('handled');
  });

  test('the root avoids the keyboard on iOS so Save stays visible', async () => {
    const os = Platform.OS;
    Platform.OS = 'ios';
    try {
      await toWhere();
      let n = screen.getByLabelText('Name').parent;
      while (n && n.type !== 'RCTScrollView') n = n.parent;
      expect(StyleSheet.flatten(n?.parent?.props.style)).toHaveProperty('paddingBottom', 0);
    } finally {
      Platform.OS = os;
    }
  });

  test('room chips: own rooms first, then the usual ones, then Other…', async () => {
    await toWhere();
    await waitFor(() => expect(btn('Office')).toBeTruthy());
    const names = screen
      .getAllByRole('button')
      .map((b) => b.props.accessibilityLabel)
      .filter((l) => ['Office', 'Kitchen', 'Living room', 'Bedroom', 'Hall', 'Other…'].includes(l));
    expect(names).toEqual(['Office', 'Kitchen', 'Living room', 'Bedroom', 'Hall', 'Other…']);
  });

  test('the save button names the plant and saves name, room, light, species, photo and scan', async () => {
    await toWhere();
    expect(save().props.accessibilityLabel).toBe('Save Moth orchid');
    await press('Living room');
    expect(btn('Living room').props.accessibilityState?.selected).toBe(true);
    expect(btn(/^Medium/).props.accessibilityState?.selected).toBe(true);
    await press(/^Bright/);
    await fireEvent.press(save());
    await waitFor(() => expect(api.createPlant).toHaveBeenCalledTimes(1));
    expect(lastSaved()).toEqual({
      name: 'Moth orchid',
      room: 'Living room',
      light: 'bright_indirect',
      speciesId: 's1',
      customType: undefined,
      photoPath: 'u/1.jpg',
      scanId: 'scan1',
    });
    await waitFor(() => expect(screen.getByText('Moth orchid is in the Living room.')).toBeTruthy());
  });

  test('a chip tapped again clears the room; Other… takes a typed room', async () => {
    await toWhere();
    await press('Kitchen');
    await press('Kitchen');
    expect(btn('Kitchen').props.accessibilityState?.selected).toBeFalsy();
    await press('Other…');
    await fireEvent.changeText(screen.getByLabelText('Room'), ' Studio ');
    expect(screen.getByLabelText('Room').props.maxLength).toBe(40);
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Fern');
    await fireEvent.press(save());
    await waitFor(() => expect(api.createPlant).toHaveBeenCalledTimes(1));
    expect(lastSaved()).toMatchObject({ name: 'Fern', room: 'Studio', light: 'medium' });
  });

  test('an empty name says Give it a name. and Save waits', async () => {
    await toWhere();
    await fireEvent.changeText(screen.getByLabelText('Name'), '  ');
    expect(screen.getByText('Give it a name.')).toBeTruthy();
    expect(save().props.accessibilityState?.disabled).toBe(true);
  });

  test('after saving, Health replaces this screen', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    try {
      await toWhere();
      await fireEvent.press(save());
      await waitFor(() => expect(screen.getByText('Moth orchid is saved.')).toBeTruthy());
      expect(mockReplace).not.toHaveBeenCalled();
      await act(async () => jest.advanceTimersByTime(800));
      expect(mockReplace).toHaveBeenCalledWith('/add/health');
    } finally {
      jest.useRealTimers();
    }
  });

  test('a double tap creates one plant', async () => {
    await toWhere();
    const b = save();
    await fireEvent.press(b);
    await fireEvent.press(b);
    await waitFor(() => expect(screen.getByText('Moth orchid is saved.')).toBeTruthy());
    expect(api.createPlant).toHaveBeenCalledTimes(1);
  });

  test('two synchronous taps create one plant (ref guard)', async () => {
    await toWhere();
    const b = save();
    const click = () => b.props.onClick({ stopPropagation() {}, nativeEvent: {} });
    await act(async () => {
      click();
      click();
    });
    await waitFor(() => expect(screen.getByText('Moth orchid is saved.')).toBeTruthy());
    expect(api.createPlant).toHaveBeenCalledTimes(1);
  });

  test('a failed save shows the error and can be retried', async () => {
    mocked(api.createPlant).mockRejectedValueOnce(new Error('boom'));
    await toWhere();
    await fireEvent.press(save());
    await waitFor(() => expect(screen.getByText("Couldn't save Moth orchid. Try again.")).toBeTruthy());
    await fireEvent.press(save());
    await waitFor(() => expect(screen.getByText('Moth orchid is saved.')).toBeTruthy());
    expect(api.createPlant).toHaveBeenCalledTimes(2);
  });

  test('Cancel is hidden while the save is pending', async () => {
    mocked(api.createPlant).mockReturnValue(new Promise(() => {}));
    await toWhere();
    expect(screen.getByText('Cancel')).toBeTruthy();
    await fireEvent.press(save());
    await waitFor(() => expect(screen.queryByText('Cancel')).toBeNull());
    expect(photos.deletePhotos).not.toHaveBeenCalled();
  });

  test('Cancel before saving deletes the upload and closes', async () => {
    await toWhere();
    await fireEvent.press(screen.getByText('Cancel'));
    expect(photos.deletePhotos).toHaveBeenCalledWith(['u/1.jpg']);
    expect(api.createPlant).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText('Name and place')).toBeNull());
  });

  test('going back after saving never creates a second plant or deletes the photo', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    try {
      await toWhere();
      await fireEvent.press(save());
      await waitFor(() => expect(screen.getByText('Moth orchid is saved.')).toBeTruthy());
      await act(async () => router.back()); // leaves before the hand-off: the result redirects to Health
      await waitFor(() => expect(screen.getByText('Want a quick health check for Moth orchid?')).toBeTruthy());
      await act(async () => router.push('/add/capture'));
      await waitFor(() => expect(screen.getByText('Want a quick health check for Moth orchid?')).toBeTruthy());
      await act(async () => router.push('/add/where'));
      await waitFor(() => expect(screen.getByText('Moth orchid is saved.')).toBeTruthy());
      expect(screen.queryByText('Cancel')).toBeNull();
      await act(async () => jest.advanceTimersByTime(800));
      expect(mockReplace).toHaveBeenCalledWith('/add/health');
      expect(api.createPlant).toHaveBeenCalledTimes(1);
      expect(photos.deletePhotos).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});

const FOOT = "We'll look at your photo for signs of pests, disease or stress. It takes a few seconds.";

describe('health', () => {
  const OK = { healthy: false, note: 'Brown tips.', advice: 'Water less.' };
  beforeEach(() => {
    mocked(api.createPlant).mockResolvedValue(plant as never);
    mocked(api.checkHealth).mockResolvedValue(OK);
  });
  const arrive = async () => {
    await toWhere();
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Fern');
    await fireEvent.press(save());
    await waitFor(() => expect(screen.getByText('Want a quick health check for Fern?')).toBeTruthy(), { timeout: 3000 });
  };

  test('Step 3 of 3 offers a check of the photo; nothing runs by itself', async () => {
    await arrive();
    expect(screen.getByRole('progressbar', { name: 'Step 3 of 3' })).toBeTruthy();
    expect(screen.getByText(FOOT)).toBeTruthy();
    expect(screen.getAllByLabelText('Your plant').length).toBeGreaterThan(0);
    expect(api.checkHealth).not.toHaveBeenCalled();
    await press('Check its health now');
    await screen.findByText('Brown tips.');
    expect(api.checkHealth).toHaveBeenCalledWith('p1', ['u/1.jpg']);
  });

  test('a running check shows its state and only the header Done; a result announces on iOS', async () => {
    const os = Platform.OS;
    Platform.OS = 'ios';
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    try {
      let resolve!: (v: typeof OK) => void;
      mocked(api.checkHealth).mockReturnValue(new Promise((r) => (resolve = r)));
      await arrive();
      await press('Check its health now');
      await waitFor(() => expect(screen.getByText('Looking at your plant…')).toBeTruthy());
      expect(screen.getAllByRole('button', { name: 'Done' })).toHaveLength(1);
      await act(async () => resolve(OK));
      await screen.findByText('Brown tips.');
      expect(announce).toHaveBeenCalledWith('Brown tips.');
    } finally {
      Platform.OS = os;
      announce.mockRestore();
    }
  });

  test('two taps in one frame start one check', async () => {
    mocked(api.checkHealth).mockReturnValue(new Promise(() => {}));
    await arrive();
    const b = btn('Check its health now');
    const click = () => b.props.onClick({ stopPropagation() {}, nativeEvent: {} });
    await act(async () => {
      click();
      click();
    });
    expect(api.checkHealth).toHaveBeenCalledTimes(1);
  });

  test('a failed check shows the error and Try again works', async () => {
    mocked(api.checkHealth).mockRejectedValueOnce(new Error('boom'));
    await arrive();
    await press('Check its health now');
    await screen.findByText("Couldn't check right now.");
    await press('Try again');
    await screen.findByText('Brown tips.');
    expect(api.checkHealth).toHaveBeenCalledTimes(2);
  });

  test('a limit failure shows the server copy', async () => {
    const HEALTH_LIMIT = "You've reached the health check limit for now. Try again later.";
    mocked(api.checkHealth).mockRejectedValueOnce(new Error(HEALTH_LIMIT));
    await arrive();
    await press('Check its health now');
    await screen.findByText(HEALTH_LIMIT);
  });

  test('Skip for now and Done go to the module offer; nothing is deleted', async () => {
    await arrive();
    await press('Skip for now');
    expect(mockReplace).toHaveBeenCalledWith('/add/module-offer');
    await waitFor(() => expect(screen.getByText('Does Fern have a module?')).toBeTruthy());
    expect(photos.deletePhotos).not.toHaveBeenCalled();
  });

  test('no Back, Cancel or swipe; header Done and Android back both go on', async () => {
    await arrive();
    expect(screen.queryByText('Cancel')).toBeNull();
    const handler = jest.spyOn(BackHandler, 'addEventListener');
    await act(async () => router.replace('/add/where'));
    await act(async () => router.replace('/add/health'));
    await waitFor(() => expect(handler).toHaveBeenCalled());
    const back = handler.mock.calls.at(-1)![1];
    await act(async () => void (back as () => void)());
    expect(mockReplace).toHaveBeenCalledWith('/add/module-offer');
    handler.mockRestore();
  });

  test('a remount does not start a second check', async () => {
    await arrive();
    await press('Check its health now');
    await screen.findByText('Brown tips.');
    await act(async () => router.replace('/add/where'));
    await waitFor(() => expect(screen.getByText('Brown tips.')).toBeTruthy(), { timeout: 3000 });
    expect(api.checkHealth).toHaveBeenCalledTimes(1);
  });
});

describe('module offer', () => {
  beforeEach(() => mocked(api.createPlant).mockResolvedValue(plant as never));
  const arrive = async () => {
    await toWhere();
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Fern');
    await fireEvent.press(save());
    await waitFor(() => expect(btn('Skip for now')).toBeTruthy(), { timeout: 3000 });
    await press('Skip for now');
    await waitFor(() => expect(screen.getByText('Does Fern have a module?')).toBeTruthy());
  };

  test('names the plant and what is needed', async () => {
    await arrive();
    expect(screen.getByRole('header', { name: 'Does Fern have a module?' })).toBeTruthy();
    for (const t of ["You'll need", 'The module and its stake', 'Water for the tank', 'Your Wi-Fi password']) {
      expect(screen.getByText(t)).toBeTruthy();
    }
  });

  test('Set up the module closes the flow and opens module setup', async () => {
    await arrive();
    mockPush.mockClear();
    await press('Set up the module');
    expect(mockDismissTo).toHaveBeenCalledWith('/');
    expect(mockPush).toHaveBeenCalledWith('/plant/p1/module');
  });

  test('Not now and Android back go Home', async () => {
    await arrive();
    const handler = jest.spyOn(BackHandler, 'addEventListener');
    await press('Not now');
    expect(mockDismissTo).toHaveBeenCalledWith('/');
    handler.mockRestore();
  });
});
