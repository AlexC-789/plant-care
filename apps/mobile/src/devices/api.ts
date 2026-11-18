import type { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

// Never `*`: authenticated has no SELECT on devices.secret_hash.
export const DEVICE_COLUMNS =
  'id, plant_id, created_at, last_seen_at, sync_interval_s, reading_ts, soil_pct, water_left_ml, float_low, battery_pct, charging, fault_code, tank_full_ml';

export type Device = Pick<
  Database['public']['Tables']['devices']['Row'],
  | 'id'
  | 'plant_id'
  | 'created_at'
  | 'last_seen_at'
  | 'sync_interval_s'
  | 'reading_ts'
  | 'soil_pct'
  | 'water_left_ml'
  | 'float_low'
  | 'battery_pct'
  | 'charging'
  | 'fault_code'
  | 'tank_full_ml'
> & { resumePending: boolean };

export async function createClaim(plantId: string): Promise<{ code: string; expires_at: string }> {
  const { data, error } = await supabase.from('device_claims').insert({ plant_id: plantId }).select('code, expires_at').single();
  if (error) throw error;
  return data;
}

export async function fetchDevice(plantId: string): Promise<Device | null> {
  const { data, error } = await supabase
    .from('devices')
    .select(`${DEVICE_COLUMNS}, device_commands(acked_at)`)
    .eq('plant_id', plantId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { device_commands, ...device } = data;
  return { ...device, resumePending: device_commands.some((c) => c.acked_at === null) };
}

export async function resumeWatering(deviceId: string): Promise<void> {
  const { error } = await supabase.from('device_commands').insert({ device_id: deviceId, type: 'clear_fault' });
  if (error) throw error;
}

export async function removeDevice(deviceId: string): Promise<void> {
  const { error } = await supabase.from('devices').delete().eq('id', deviceId);
  if (error) throw error;
}
