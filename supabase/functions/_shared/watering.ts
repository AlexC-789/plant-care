// Module watering rules. Pure TypeScript, no imports, no runtime APIs: the Node simulator imports this
// file and the ESP32 firmware ports it. Never relax LIMITS.
export const LIMITS = {
  worstPumpMlPerS: 4.0, maxDosePumpMs: 10_000, maxDayPumpMs: 37_500,
  minRiseRaw: 30, // soil raw must drop at least this much after a dose to count as a rise
  refillRiseRaw: 150, // tank raw rise between wakes that counts as a refill
  soilRawMin: 500, soilRawMax: 3500, // plausible soil sensor range
  lowBatteryMv: 3650,
  readS: [300, 3600] as const, syncS: [900, 21_600] as const,
  backoffS: [3600, 7200, 14_400, 21_600] as const,
};

export type Fault = 'no_moisture_rise' | 'sensor_out_of_range' | null;
export interface Instructions {
  water_when_soil_raw_above: number; pump_ms: number; min_minutes_between_doses: number;
  read_interval_s: number; sync_interval_s: number;
}
export const DEFAULT_INSTRUCTIONS: Instructions = {
  water_when_soil_raw_above: 2400, pump_ms: 5000, min_minutes_between_doses: 120, read_interval_s: 900, sync_interval_s: 3600,
};
export interface RawReading { ts: string; soil_raw: number; tank_raw: number; float_low: boolean; battery_mv: number; charging: boolean }
export type EventType = 'watered' | 'refill_detected' | 'tank_low' | 'battery_low' | 'boot' | 'fault';
export interface DeviceEvent { ts: string; type: EventType; pump_ms?: number; code?: Exclude<Fault, null> }
export interface ModuleState {
  instructions: Instructions;
  doses: { at: number; pump_ms: number }[]; // epoch ms, pruned to the last 24 h
  pendingRise: { soilRawBefore: number } | null; // set by a dose, checked at the next wake
  noRiseCount: number;
  fault: Fault;
  last: { tank_raw: number; float_low: boolean; battery_mv: number } | null;
  failedSyncs: number;
}

const DAY_MS = 24 * 3_600_000;

// Non-finite (NaN, Infinity) falls to the low bound (pump 0, shortest interval).
// Non-finite min minutes (null/NaN/Infinity from JSON) must not mean "no wait": use the default.
const minMinutes = (x: number) => (Number.isFinite(x) ? Math.max(x, 0) : DEFAULT_INSTRUCTIONS.min_minutes_between_doses);
const clamp = (x: number, lo: number, hi: number) => (Number.isFinite(x) ? Math.min(Math.max(x, lo), hi) : lo);

export function newState(): ModuleState {
  return { instructions: { ...DEFAULT_INSTRUCTIONS }, doses: [], pendingRise: null, noRiseCount: 0, fault: null, last: null, failedSyncs: 0 };
}

// Saved state lost: assume the whole 24 h budget was just used.
export function freshState(now: number): ModuleState {
  return { ...newState(), doses: [{ at: now, pump_ms: LIMITS.maxDayPumpMs }] };
}

export function clampInstructions(i: Instructions): Instructions {
  return {
    water_when_soil_raw_above: i.water_when_soil_raw_above,
    pump_ms: Math.floor(clamp(i.pump_ms, 0, LIMITS.maxDosePumpMs)),
    min_minutes_between_doses: minMinutes(i.min_minutes_between_doses),
    read_interval_s: clamp(i.read_interval_s, LIMITS.readS[0], LIMITS.readS[1]),
    sync_interval_s: clamp(i.sync_interval_s, LIMITS.syncS[0], LIMITS.syncS[1]),
  };
}

export function wake(
  state: ModuleState, r: RawReading, now: number,
): { state: ModuleState; pumpMs: number; events: DeviceEvent[]; syncNow: boolean } {
  const s: ModuleState = { ...state, doses: state.doses.filter((d) => d.at > now - DAY_MS) };
  const events: DeviceEvent[] = [];
  const raise = (code: Exclude<Fault, null>) => {
    s.fault = code;
    events.push({ ts: r.ts, type: 'fault', code });
  };

  const inRange = r.soil_raw >= LIMITS.soilRawMin && r.soil_raw <= LIMITS.soilRawMax;
  // (1) did the last dose raise moisture? An out-of-range reading (glitch) is never a rise.
  if (s.pendingRise) {
    s.noRiseCount = inRange && r.soil_raw <= s.pendingRise.soilRawBefore - LIMITS.minRiseRaw ? 0 : s.noRiseCount + 1;
    s.pendingRise = null;
    if (s.noRiseCount >= 2 && s.fault !== 'no_moisture_rise') raise('no_moisture_rise');
  }

  // (2) sensor range; an existing no_moisture_rise fault is kept
  if (!inRange && s.fault === null) raise('sensor_out_of_range');
  else if (inRange && s.fault === 'sensor_out_of_range') s.fault = null;

  // (3) events from the previous wake
  const l = s.last;
  if (l) {
    if (r.float_low && !l.float_low) events.push({ ts: r.ts, type: 'tank_low' });
    if (r.tank_raw - l.tank_raw >= LIMITS.refillRiseRaw) events.push({ ts: r.ts, type: 'refill_detected' });
    if (r.battery_mv < LIMITS.lowBatteryMv && l.battery_mv >= LIMITS.lowBatteryMv) events.push({ ts: r.ts, type: 'battery_low' });
  }
  s.last = { tank_raw: r.tank_raw, float_low: r.float_low, battery_mv: r.battery_mv };

  // (4) dose
  let pumpMs = 0;
  const i = s.instructions;
  const lastDose = s.doses.reduce((m, d) => Math.max(m, d.at), -Infinity);
  const used = s.doses.reduce((sum, d) => sum + d.pump_ms, 0);
  const allowed = s.fault === null && r.float_low === false && r.soil_raw > i.water_when_soil_raw_above &&
    now - lastDose >= minMinutes(i.min_minutes_between_doses) * 60_000;
  if (allowed) {
    pumpMs = Math.floor(Math.min(clamp(i.pump_ms, 0, LIMITS.maxDosePumpMs), LIMITS.maxDayPumpMs - used));
    if (pumpMs > 0) {
      s.doses.push({ at: now, pump_ms: pumpMs });
      s.pendingRise = { soilRawBefore: r.soil_raw };
      events.push({ ts: r.ts, type: 'watered', pump_ms: pumpMs });
    } else pumpMs = 0;
  }

  return { state: s, pumpMs, events, syncNow: events.length > 0 };
}

export function clearFault(state: ModuleState): ModuleState {
  return state.fault === 'no_moisture_rise' ? { ...state, fault: null, noRiseCount: 0 } : state;
}

export function afterSync(state: ModuleState, ok: boolean, instructions?: Instructions): ModuleState {
  if (!ok) return { ...state, failedSyncs: state.failedSyncs + 1 };
  return { ...state, failedSyncs: 0, instructions: instructions ? clampInstructions(instructions) : state.instructions };
}

export function nextSyncDelayS(state: ModuleState): number {
  const n = state.failedSyncs;
  return n === 0 ? state.instructions.sync_interval_s : LIMITS.backoffS[Math.min(n - 1, 3)];
}
