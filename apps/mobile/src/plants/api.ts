import type { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

import { deletePhotos, signPhotoUrls } from './photos';

export type Plant = Database['public']['Tables']['plants']['Row'];
export type Species = Database['public']['Tables']['species']['Row'];
export type Scan = Database['public']['Tables']['scans']['Row'];
export type PlantsPage = { plants: Plant[]; photoUrls: Record<string, string> };
export type NewPlant = {
  name: string;
  room?: string;
  speciesId?: string;
  customType?: string;
  photoPath?: string;
  scanId?: string;
};
export type PlantPatch = Partial<Pick<Plant, 'name' | 'room' | 'species_id' | 'custom_type' | 'photo_path'>>;
export type Confidence = 'very_likely' | 'likely' | 'possibly';
export type IdentifyResult = {
  scanId?: string;
  isPlant: boolean;
  suggestions: { speciesId: string; commonName: string; scientificName: string; confidence: Confidence }[];
};
export type HealthResult = { healthy: boolean | null; note: string; advice: string | null };
export type SpeciesHit = { commonName: string; scientificName: string };

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
    .select('*')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
  if (error) throw error;
  const paths = data.flatMap((p) => (p.photo_path ? [p.photo_path] : []));
  return { plants: data, photoUrls: await signPhotoUrls(paths) };
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

export async function fetchLatestHealth(plantId: string): Promise<Scan | null> {
  const { data, error } = await supabase
    .from('scans')
    .select('*')
    .eq('plant_id', plantId)
    .eq('kind', 'health')
    .eq('status', 'ok')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createPlant(p: NewPlant): Promise<Plant> {
  const { data, error } = await supabase
    .from('plants')
    .insert({
      name: p.name,
      room: p.room,
      species_id: p.speciesId,
      custom_type: p.customType,
      photo_path: p.photoPath,
    })
    .select('*')
    .single();
  if (error) throw error;
  if (p.scanId) {
    const { error: linkError } = await supabase.from('scans').update({ plant_id: data.id }).eq('id', p.scanId);
    if (linkError) throw linkError;
  }
  return data;
}

export async function updatePlant(id: string, patch: PlantPatch): Promise<Plant> {
  const { data, error } = await supabase.from('plants').update(patch).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

/** Row first (scans cascade), photos after: a failure never leaves a row pointing at deleted photos. */
export async function deletePlant(id: string): Promise<void> {
  const [{ data: plant, error: e1 }, { data: scans, error: e2 }] = await Promise.all([
    supabase.from('plants').select('photo_path').eq('id', id).single(),
    supabase.from('scans').select('photo_paths').eq('plant_id', id),
  ]);
  if (e1 || e2) throw e1 ?? e2;
  const { error } = await supabase.from('plants').delete().eq('id', id);
  if (error) throw error;
  const paths = [plant.photo_path, ...scans.flatMap((s) => s.photo_paths)].filter((p): p is string => !!p);
  // shortcut: orphaned objects are accepted if removal fails, a cleanup job comes at store readiness.
  await deletePhotos(paths).catch(() => {});
}
