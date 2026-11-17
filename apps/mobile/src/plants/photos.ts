import { randomUUID } from 'expo-crypto';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { supabase } from '@/lib/supabase';

const BUCKET = 'plant-photos';
const MAX_SIDE = 1600;

export type PreparedPhoto = { uri: string; width: number; height: number };

/** Always re-encodes (JPEG 0.7, longest side ≤ 1600, never upscaled): this drops EXIF/GPS. */
export async function preparePhoto(uri: string): Promise<PreparedPhoto> {
  const ctx = ImageManipulator.manipulate(uri);
  let image = await ctx.renderAsync();
  const { width, height } = image;
  if (Math.max(width, height) > MAX_SIDE) {
    image = await ctx.resize(width >= height ? { width: MAX_SIDE } : { height: MAX_SIDE }).renderAsync();
  }
  const out = await image.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
  return { uri: out.uri, width: out.width, height: out.height };
}

export async function uploadPhoto(userId: string, photo: PreparedPhoto): Promise<string> {
  const path = `${userId}/${randomUUID()}.jpg`;
  const body = await (await fetch(photo.uri)).arrayBuffer();
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
