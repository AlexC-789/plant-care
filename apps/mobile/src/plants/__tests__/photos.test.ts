import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { supabase } from '@/lib/supabase';
import { deletePhotos, preparePhoto, signPhotoUrls, uploadPhoto } from '@/plants/photos';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories must be self-contained
jest.mock('@/lib/supabase', () => require('@/test-utils/supabaseMock'));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid-1' }));
jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: jest.fn() },
  SaveFormat: { JPEG: 'jpeg' },
}));

/** Fake manipulator: source image of the given size; records resize and save calls. */
function fakeManipulator(width: number, height: number) {
  const saved = { uri: 'file:///out.jpg', width: 0, height: 0 };
  const save = jest.fn(async () => saved);
  const resize = jest.fn();
  const ctx = {
    resize: resize.mockImplementation((size: { width?: number; height?: number }) => {
      if (size.width) Object.assign(saved, { width: size.width, height: Math.round((height * size.width) / width) });
      else Object.assign(saved, { height: size.height, width: Math.round((width * size.height!) / height) });
      return ctx;
    }),
    renderAsync: jest.fn(async () => ({ width, height, saveAsync: save })),
  };
  Object.assign(saved, { width, height });
  (ImageManipulator.manipulate as jest.Mock).mockReturnValue(ctx);
  return { resize, save };
}

beforeEach(() => jest.clearAllMocks());

describe('preparePhoto', () => {
  it('resizes a landscape photo to 1600 wide and re-encodes as JPEG 0.7', async () => {
    const { resize, save } = fakeManipulator(4000, 3000);
    const out = await preparePhoto('file:///in.heic');
    expect(resize).toHaveBeenCalledWith({ width: 1600 });
    expect(save).toHaveBeenCalledWith({ compress: 0.7, format: SaveFormat.JPEG });
    expect(out).toEqual({ uri: 'file:///out.jpg', width: 1600, height: 1200 });
  });

  it('resizes a portrait photo by height', async () => {
    const { resize } = fakeManipulator(3000, 4000);
    await preparePhoto('file:///in.jpg');
    expect(resize).toHaveBeenCalledWith({ height: 1600 });
  });

  it('never upscales but still re-encodes (strips EXIF)', async () => {
    const { resize, save } = fakeManipulator(800, 600);
    const out = await preparePhoto('file:///in.jpg');
    expect(resize).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledWith({ compress: 0.7, format: SaveFormat.JPEG });
    expect(out).toEqual({ uri: 'file:///out.jpg', width: 800, height: 600 });
  });
});

describe('storage', () => {
  const bucket = {
    upload: jest.fn(),
    remove: jest.fn(),
    createSignedUrls: jest.fn(),
  };
  beforeEach(() => (supabase.storage.from as jest.Mock).mockReturnValue(bucket));

  it('uploads to plant-photos/{user}/{uuid}.jpg as image/jpeg and returns the path', async () => {
    bucket.upload.mockResolvedValue({ error: null });
    (globalThis.fetch as unknown) = jest.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(3) }));
    const path = await uploadPhoto('user-1', { uri: 'file:///out.jpg', width: 1, height: 1 });
    expect(path).toBe('user-1/uuid-1.jpg');
    expect(supabase.storage.from).toHaveBeenCalledWith('plant-photos');
    expect(bucket.upload).toHaveBeenCalledWith('user-1/uuid-1.jpg', expect.any(ArrayBuffer), {
      contentType: 'image/jpeg',
    });
  });

  it('throws when the upload fails', async () => {
    bucket.upload.mockResolvedValue({ error: new Error('nope') });
    (globalThis.fetch as unknown) = jest.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(3) }));
    await expect(uploadPhoto('u', { uri: 'x', width: 1, height: 1 })).rejects.toThrow('nope');
  });

  it('removes photos in one call and skips empty input', async () => {
    bucket.remove.mockResolvedValue({ error: null });
    await deletePhotos([]);
    expect(bucket.remove).not.toHaveBeenCalled();
    await deletePhotos(['a', 'b']);
    expect(bucket.remove).toHaveBeenCalledWith(['a', 'b']);
  });

  it('signs all paths in one call (1 h) and maps path to url', async () => {
    bucket.createSignedUrls.mockResolvedValue({
      data: [
        { path: 'a', signedUrl: 'https://s/a' },
        { path: 'b', signedUrl: 'https://s/b' },
      ],
      error: null,
    });
    expect(await signPhotoUrls([])).toEqual({});
    expect(bucket.createSignedUrls).not.toHaveBeenCalled();
    expect(await signPhotoUrls(['a', 'b'])).toEqual({ a: 'https://s/a', b: 'https://s/b' });
    expect(bucket.createSignedUrls).toHaveBeenCalledTimes(1);
    expect(bucket.createSignedUrls).toHaveBeenCalledWith(['a', 'b'], 3600);
  });
});
