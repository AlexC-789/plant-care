import { DEVICE_COLUMNS, type Device } from '@/devices/api';
import type { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

import { deletePhotos, type PreparedPhoto, signPhotoUrls, uploadPhoto } from './photos';

export type Plant = Database['public']['Tables']['plants']['Row'];
export type Species = Database['public']['Tables']['species']['Row'];
export type Scan = Database['public']['Tables']['scans']['Row'];
/** A Home row: the plant, its module and its species' common names (for "{type}, {room}"). */
export type PlantWithDevice = Plant & { device: Device | null; species?: { common_names: string[] } | null };
export type PlantsPage = { plants: PlantWithDevice[]; photoUrls: Record<string, string> };
/** Light where the plant stands; same values as `species.light` (the add flow offers three). */
export type Light = 'bright_indirect' | 'medium' | 'low' | 'direct';
export type NewPlant = {
  name: string;
  room?: string;
  light?: Light;
  speciesId?: string;
  customType?: string;
  photoPath?: string;
  scanId?: string;
};
export type PlantPatch = Partial<Pick<Plant, 'name' | 'room' | 'species_id' | 'custom_type' | 'photo_path'>>;
export type Confidence = 'very_likely' | 'likely' | 'possibly';
/** Attach an identify scan to a plant (the owner may set `scans.plant_id` once). */
export async function linkScan(scanId: string, plantId: string): Promise<void> {
  const { error } = await supabase.from('scans').update({ plant_id: plantId }).eq('id', scanId);
  if (error) throw error;
}

export type IdentifyResult = {
  scanId?: string;
  isPlant: boolean;
  suggestions: { speciesId: string; commonName: string; scientificName: string; confidence: Confidence }[];
};
export type HealthResult = { healthy: boolean | null; note: string; advice: string | null };
export type SpeciesHit = { commonName: string; scientificName: string };
export type PlantPhoto = { id: string; path: string; taken_at: string; scan_id: string | null; health: HealthResult | null };
export type PlantPhotosPage = { photos: PlantPhoto[]; photoUrls: Record<string, string> };

export const PAGE_SIZE = 20;

/** Invoke an Edge Function; on a non-2xx throw the server's user-facing `{error}` message. */
async function callFunction<T>(name: string, body: object): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const message = await (error.context?.json?.() as Promise<{ error?: string }> | undefined)
      ?.then((b) => b.error)
      .catch(() => undefined);
    throw new Error(message ?? error.message);
  }
  return data as T;
}

export const identifyPlant = (photoPaths: string[]) => callFunction<IdentifyResult>('identify-plant', { photoPaths });
export const checkHealth = (plantId: string, photoPaths: string[]) =>
  callFunction<HealthResult>('check-health', { plantId, photoPaths });
export const searchPlantNames = (query: string) =>
  callFunction<{ hits: SpeciesHit[] }>('search-plants', { query }).then((r) => r.hits);
export const pickSpecies = (scientificName: string) =>
  callFunction<{ speciesId: string }>('search-plants', { pick: scientificName }).then((r) => r.speciesId);

export async function fetchPlantsPage(page: number): Promise<PlantsPage> {
  const { data, error } = await supabase
    .from('plants')
    .select(`*, device:devices(${DEVICE_COLUMNS}), species(common_names)`)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
  if (error) throw error;
  const plants = data.map((p) => ({ ...p, device: p.device ? { ...p.device, resumePending: false } : null }));
  const paths = plants.flatMap((p) => (p.photo_path ? [p.photo_path] : []));
  return { plants, photoUrls: await signPhotoUrls(paths) };
}

export async function fetchPlant(id: string): Promise<Plant> {
  const { data, error } = await supabase.from('plants').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function fetchSpecies(id: string): Promise<Species> {
  const { data, error } = await supabase.from('species').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function searchLocalSpecies(q: string): Promise<Species[]> {
  const escaped = q.replace(/[\\%_]/g, '\\$&');
  const { data, error } = await supabase.from('species').select('*').ilike('search_text', `%${escaped}%`).limit(20);
  if (error) throw error;
  return data;
}

export async function createPlant(p: NewPlant): Promise<Plant> {
  const { data, error } = await supabase
    .from('plants')
    .insert({
      name: p.name,
      room: p.room,
      light: p.light,
      species_id: p.speciesId,
      custom_type: p.customType,
      photo_path: p.photoPath,
    })
    .select('*')
    .single();
  if (error) throw error;
  if (p.scanId) {
    const { error: linkError } = await supabase.from('scans').update({ plant_id: data.id }).eq('id', p.scanId);
    if (linkError) {
      await supabase.from('plants').delete().eq('id', data.id); // a retry must not leave a second plant sharing the photo
      throw linkError;
    }
  }
  return data;
}

export async function updatePlant(id: string, patch: PlantPatch): Promise<Plant> {
  const { data, error } = await supabase.from('plants').update(patch).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

/** Row first (scans and timeline rows cascade), photos after: a failure never leaves a row pointing at deleted photos. */
export async function deletePlant(id: string): Promise<void> {
  const [{ data: plant, error: e1 }, { data: scans, error: e2 }, { data: photos, error: e3 }] = await Promise.all([
    supabase.from('plants').select('photo_path').eq('id', id).single(),
    supabase.from('scans').select('photo_paths').eq('plant_id', id),
    supabase.from('plant_photos').select('path').eq('plant_id', id),
  ]);
  if (e1 || e2 || e3) throw e1 ?? e2 ?? e3;
  const { error } = await supabase.from('plants').delete().eq('id', id);
  if (error) throw error;
  const all = [plant.photo_path, ...scans.flatMap((s) => s.photo_paths), ...photos.map((p) => p.path)];
  const paths = [...new Set(all.filter((p): p is string => !!p))];
  // shortcut: orphaned objects are accepted if removal fails, a cleanup job comes at store readiness.
  await deletePhotos(paths).catch(() => {});
}

/** One page of a plant's timeline, newest first, with the health result of a linked check. */
export async function fetchPlantPhotos(plantId: string, page: number): Promise<PlantPhotosPage> {
  const { data, error } = await supabase
    .from('plant_photos')
    .select('id, path, taken_at, scan_id, scans(health)')
    .eq('plant_id', plantId)
    .order('taken_at', { ascending: false })
    .order('id', { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
  if (error) throw error;
  const photos = data.map(({ scans, ...p }) => {
    const h = scans?.health as HealthResult | null | undefined;
    return { ...p, health: h ? { healthy: h.healthy, note: h.note, advice: h.advice } : null };
  });
  return { photos, photoUrls: await signPhotoUrls(photos.map((p) => p.path)) };
}

/** Upload, then make it the main photo; the `plants_photo_to_timeline` trigger adds the timeline row. */
export async function addPlantPhoto(userId: string, plantId: string, photo: PreparedPhoto): Promise<string> {
  const path = await uploadPhoto(userId, photo);
  const { error } = await supabase.from('plants').update({ photo_path: path }).eq('id', plantId).select('id').single();
  if (error) {
    await deletePhotos([path]).catch(() => {});
    throw error;
  }
  return path;
}

/**
 * One atomic server call deletes the row and moves the main photo to the next newest (none → null,
 * pot drawing); the stored object goes last, so nothing ever points at a deleted object.
 */
export async function deletePlantPhoto(photo: { id: string }): Promise<void> {
  const { data: path, error } = await supabase.rpc('delete_plant_photo', { photo_id: photo.id });
  if (error) throw error;
  // shortcut: orphaned object if removal fails, a cleanup job comes at store readiness.
  if (path) await deletePhotos([path]).catch(() => {});
}
