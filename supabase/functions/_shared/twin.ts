// Digital-twin maths: raw module numbers -> soil %, water left, battery, and the instructions sent back.
// Pure TypeScript (no Deno APIs). Degenerate calibration or non-finite input gives null, never NaN.
import { clampInstructions, DEFAULT_INSTRUCTIONS, type Instructions, LIMITS } from './watering.ts';

export const BAND = { minPct: 35, maxPct: 55 }; // mirrored in apps/mobile/src/devices/status.ts
export const DOSE_ML = 30;
export const LOW_BATTERY_PCT = 20;

export interface Calibration {
  soil_air_raw: number; soil_wet_raw: number; tank_empty_raw: number; tank_full_raw: number;
  tank_full_ml: number; pump_ml_per_s: number;
}

const clamp = (x: number, lo: number, hi: number) => Math.min(Math.max(x, lo), hi);
const ok = (...xs: number[]) => xs.every(Number.isFinite);

export function soilPct(raw: number, c: Calibration): number | null {
  const span = c.soil_air_raw - c.soil_wet_raw;
  if (!ok(raw, span) || span === 0) return null;
  return Math.round(clamp(((c.soil_air_raw - raw) / span) * 100, 0, 100) * 10) / 10;
}

export function waterLeftMl(raw: number, c: Calibration): number | null {
  const span = c.tank_full_raw - c.tank_empty_raw;
  if (!ok(raw, span, c.tank_full_ml) || span === 0) return null;
  const f = (raw - c.tank_empty_raw) / span;
  if (f < -0.05 || f > 1.05) return null;
  return Math.round(clamp(f, 0, 1) * c.tank_full_ml);
}

const BATTERY: [number, number][] = [
  [3300, 0], [3500, 5], [3600, 10], [3650, 20], [3700, 30], [3750, 40], [3800, 50], [3900, 65], [4000, 80], [4100, 90], [4200, 100],
];

export function batteryPct(mv: number): number {
  if (!Number.isFinite(mv) || mv <= 3300) return 0;
  if (mv >= 4200) return 100;
  const j = BATTERY.findIndex(([v]) => v > mv);
  const [v0, p0] = BATTERY[j - 1], [v1, p1] = BATTERY[j];
  return Math.round(p0 + ((mv - v0) / (v1 - v0)) * (p1 - p0));
}

export function wateredMl(pumpMs: number, c: Calibration): number {
  return Math.round((pumpMs / 1000) * c.pump_ml_per_s * 10) / 10;
}

export function instructionsFor(c: Calibration, battery: number | null): Instructions {
  const sync_interval_s = battery !== null && battery < LOW_BATTERY_PCT ? 10_800 : 3600;
  const span = c.soil_air_raw - c.soil_wet_raw;
  if (!ok(span, c.pump_ml_per_s) || span === 0 || c.pump_ml_per_s <= 0) {
    return clampInstructions({ ...DEFAULT_INSTRUCTIONS, sync_interval_s });
  }
  return clampInstructions({
    water_when_soil_raw_above: Math.round(c.soil_air_raw - (BAND.minPct / 100) * span),
    pump_ms: Math.round((Math.min(DOSE_ML, 40) / c.pump_ml_per_s) * 1000),
    min_minutes_between_doses: 60,
    read_interval_s: 900,
    sync_interval_s,
  });
}
