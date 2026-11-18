import type { Device } from './api';

// Mirrors supabase/functions/_shared/twin.ts (Deno code, not importable here): keep in step.
export const BAND = { minPct: 35, maxPct: 55 };
export const LOW_BATTERY_PCT = 20;

export type Level = 'now' | 'soon' | 'quiet' | 'fine';
export type StatusKey = 'setup' | 'waiting' | 'fault' | 'tank' | 'offline' | 'wet' | 'battery' | 'fine';
export interface Status {
  key: StatusKey;
  level: Level;
  line: string;
  banner: string | null;
}

const DAY = 86_400_000;

/** Today: the time; within 6 days: the weekday; else the date. Follows the device locale. */
export function timeLabel(iso: string, now: Date): string {
  const d = new Date(iso);
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (now.getTime() - d.getTime() < 6 * DAY) return d.toLocaleDateString([], { weekday: 'long' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

export function soilLabel(pct: number | null): string {
  if (pct === null) return '—';
  const word = pct < BAND.minPct ? 'Dry' : pct > BAND.maxPct ? 'Very wet' : 'Damp';
  return `${word} · ${pct} %`;
}

export function waterLabel(d: Device): string {
  if (d.float_low) return 'Needs refilling';
  if (d.water_left_ml === null) return '—';
  return `About ${Math.round(d.water_left_ml / 50) * 50} ml left`;
}

export function deviceStatus(d: Device | null, now: Date): Status {
  if (!d) return { key: 'setup', level: 'quiet', line: "Setup isn't finished · Add its module", banner: null };
  if (d.fault_code) {
    return {
      key: 'fault',
      level: 'now',
      line: 'Watering stopped · Check the stake is in the soil',
      banner:
        d.fault_code === 'no_moisture_rise'
          ? "Watering stopped. Check the stake is in the soil and the tube isn't kinked, then resume."
          : 'Watering stopped. Check the stake is pushed into the soil; it resumes by itself.',
    };
  }
  if (d.float_low) {
    return {
      key: 'tank',
      level: 'now',
      line: 'Tank needs refilling',
      banner: "The tank needs refilling. Watering is paused until it's filled.",
    };
  }
  if (d.last_seen_at && now.getTime() - new Date(d.last_seen_at).getTime() > 3 * d.sync_interval_s * 1000) {
    const t = timeLabel(d.last_seen_at, now);
    const lowBattery = d.battery_pct !== null && d.battery_pct < LOW_BATTERY_PCT;
    return {
      key: 'offline',
      level: lowBattery ? 'now' : 'quiet',
      line: `Not heard from since ${t}${lowBattery ? ' · Its battery was low' : ''}`,
      banner: `Not heard from since ${t}. It should keep watering on its last instructions.`,
    };
  }
  if (d.reading_ts === null) {
    return { key: 'waiting', level: 'quiet', line: 'Waiting for its first check-in', banner: null };
  }
  if (d.soil_pct !== null && d.soil_pct > BAND.maxPct) {
    return { key: 'wet', level: 'soon', line: 'Soil is very wet · Watering is on hold', banner: null };
  }
  if (d.battery_pct !== null && d.battery_pct < LOW_BATTERY_PCT) {
    return {
      key: 'battery',
      level: 'soon',
      line: 'Battery is low · Charge it this week',
      banner: 'Battery is low. Charge it this week.',
    };
  }
  return { key: 'fine', level: 'fine', line: 'Doing well · Still learning how fast it drinks', banner: null };
}

export const needsYou = (s: Status) => s.level !== 'fine';
