import { uuid } from 'expo';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { supabase } from '@/lib/supabase';

const BUCKET = 'plant-photos';
const MAX_SIDE = 1600;

/** `base64` is the encoded JPEG: the upload uses it because reading `uri` back on Android gave 0 bytes. */
export type PreparedPhoto = { uri: string; width: number; height: number; base64: string };

/** Always re-encodes (JPEG 0.7, longest side ≤ 1600, never upscaled): this drops EXIF/GPS. */
export async function preparePhoto(uri: string): Promise<PreparedPhoto> {
  const ctx = ImageManipulator.manipulate(uri);
  let image = await ctx.renderAsync();
  const { width, height } = image;
  if (Math.max(width, height) > MAX_SIDE) {
    image = await ctx.resize(width >= height ? { width: MAX_SIDE } : { height: MAX_SIDE }).renderAsync();
  }
  const out = await image.saveAsync({ compress: 0.7, format: SaveFormat.JPEG, base64: true });
  return { uri: out.uri, width: out.width, height: out.height, base64: out.base64 ?? '' };
}

export async function uploadPhoto(userId: string, photo: PreparedPhoto): Promise<string> {
  const body = Uint8Array.from(atob(photo.base64), (c) => c.charCodeAt(0));
  if (!body.length) throw new Error('Empty photo');
  const path = `${userId}/${uuid.v4()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, { contentType: 'image/jpeg' });
  if (error) throw error;
  return path;
}

export async function deletePhotos(paths: string[]): Promise<void> {
  if (!paths.length) return;
  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) throw error;
}

/** Signed URLs (1 h) for many paths in one request. */
export async function signPhotoUrls(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
  if (error) throw error;
  return Object.fromEntries(data.flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl]] : [])));
}
