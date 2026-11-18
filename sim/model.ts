// Physical model of the module: soil, tank, level sensor, float switch, battery. Pure; noise is seeded.
import type { RawReading } from '../supabase/functions/_shared/watering.ts';

export const SENSOR = { soilAirRaw: 2900, soilWetRaw: 1200, tankEmptyRaw: 1000, tankFullRaw: 3000, tankFullMl: 705, pumpMlPerS: 3.0, floatLowMl: 100 };
export type Scenario = 'normal' | 'drought' | 'tank-empty' | 'offline-6h' | 'stake-out-of-soil' | 'battery-low';
export interface World { soilPct: number; tankMl: number; batteryMv: number; stakeInSoil: boolean; dryPctPerHour: number; seed: number }

const BASE_DRY_PCT_PER_HOUR = 1.5;
const SOIL_PCT_PER_ML = 0.6;
const BATTERY_MV_PER_HOUR = 2;
// The server skips readings outside 2500-4500 mV.
const clampMv = (mv: number) => Math.min(Math.max(Math.round(mv), 2500), 4500);

export function initialWorld(s: Scenario): World {
  return {
    soilPct: 45,
    tankMl: s === 'tank-empty' ? 50 : s === 'normal' ? 0 : SENSOR.tankFullMl,
    batteryMv: s === 'battery-low' ? 3450 : 4100,
    stakeInSoil: s !== 'stake-out-of-soil',
    dryPctPerHour: s === 'drought' ? BASE_DRY_PCT_PER_HOUR * 3 : BASE_DRY_PCT_PER_HOUR,
    seed: 1,
  };
}

// mulberry32 step: returns [noise in [-1, 1), next seed]
function rnd(seed: number): [number, number] {
  let t = (seed + 0x6d2b79f5) >>> 0;
  const s = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 2 ** 31 - 1, s];
}

export function advance(w: World, hours: number): World {
  return {
    ...w,
    soilPct: Math.max(0, w.soilPct - w.dryPctPerHour * hours),
    batteryMv: clampMv(w.batteryMv - BATTERY_MV_PER_HOUR * hours),
    seed: rnd(w.seed)[1],
  };
}

export function readSensors(w: World, ts: string): RawReading {
  const [n1] = rnd(w.seed);
  const [n2] = rnd(w.seed + 1);
  const soil = w.stakeInSoil ? SENSOR.soilAirRaw - (SENSOR.soilAirRaw - SENSOR.soilWetRaw) * (w.soilPct / 100) : SENSOR.soilAirRaw;
  const tank = SENSOR.tankEmptyRaw + (SENSOR.tankFullRaw - SENSOR.tankEmptyRaw) * (w.tankMl / SENSOR.tankFullMl);
  return {
    ts,
    soil_raw: Math.round(soil + n1 * 10),
    tank_raw: Math.round(tank + n2 * 10),
    float_low: w.tankMl <= SENSOR.floatLowMl,
    battery_mv: clampMv(w.batteryMv),
    charging: false,
  };
}

export function pump(w: World, pumpMs: number): World {
  const ml = Math.min(w.tankMl, (pumpMs / 1000) * SENSOR.pumpMlPerS);
  return { ...w, tankMl: w.tankMl - ml, soilPct: w.stakeInSoil ? Math.min(100, w.soilPct + ml * SOIL_PCT_PER_ML) : w.soilPct };
}

export function fill(w: World, fraction: number): World {
  return { ...w, tankMl: Math.min(SENSOR.tankFullMl, w.tankMl + fraction * SENSOR.tankFullMl) };
}

export function offline(s: Scenario, simStartMs: number, nowMs: number): boolean {
  return s === 'offline-6h' && nowMs >= simStartMs + 3_600_000 && nowMs < simStartMs + 7 * 3_600_000;
}
