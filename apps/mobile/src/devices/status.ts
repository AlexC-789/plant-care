import type { Device } from './api';

// Mirrors supabase/functions/_shared/twin.ts (Deno code, not importable here): keep in step.
export const BAND = { minPct: 35, maxPct: 55 };
export const LOW_BATTERY_PCT = 20;

/** now = needs you, in red (fault, tank); soon = needs you, in ink; fine = doing well. */
export type Level = 'now' | 'soon' | 'fine';
export type StatusKey = 'setup' | 'waiting' | 'fault' | 'tank' | 'offline' | 'wet' | 'battery' | 'fine';
export interface Status {
  key: StatusKey;
  level: Level;
  /** The one sentence on Home. */
  line: string;
  /** Plant page headline and the line under it. */
  headline: string;
  detail: string;
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
  return `${word}, ${Math.round(pct)} %`;
}

const status = (key: StatusKey, level: Level, line: string, detail: string, headline = line): Status => ({
  key,
  level,
  line,
  headline,
  detail,
});

/** UX_ARCHITECTURE §6: the first rule that matches wins. */
export function deviceStatus(d: Device | null, now: Date): Status {
  if (!d) {
    return status(
      'setup',
      'fine',
      'No module',
      'Photos and health checks only. Set up a module to water it automatically.',
      'No module yet',
    );
  }
  if (d.fault_code) {
    return status(
      'fault',
      'now',
      'Watering stopped',
      d.fault_code === 'no_moisture_rise'
        ? "Check the stake is in the soil and the tube isn't kinked, then resume."
        : 'Check the stake is pushed into the soil. It resumes by itself.',
    );
  }
  if (d.float_low) {
    return status('tank', 'now', 'Tank needs refilling', 'Watering is paused. It starts again by itself once you top it up.');
  }
  if (d.last_seen_at && now.getTime() - new Date(d.last_seen_at).getTime() > 3 * d.sync_interval_s * 1000) {
    return status(
      'offline',
      'soon',
      `Not heard from since ${timeLabel(d.last_seen_at, now)}`,
      'It may be out of Wi-Fi range or its battery may be flat.',
    );
  }
  if (d.reading_ts === null) {
    return status('waiting', 'fine', 'Waiting for its first check-in', 'This can take a few minutes after setup.');
  }
  if (d.soil_pct !== null && d.soil_pct > BAND.maxPct) {
    return status('wet', 'fine', 'Soil is very wet', 'Watering is on hold until it dries a little.');
  }
  if (d.battery_pct !== null && d.battery_pct < LOW_BATTERY_PCT) {
    return status('battery', 'soon', 'Battery low', 'Charge the module in the next few days.');
  }
  // shortcut: no drink-rate estimate yet, so no "about {n} days"; M5 watering plans add it.
  return status('fine', 'fine', 'Learning how fast it drinks', 'It waters itself when the soil starts to dry.');
}

export const needsYou = (s: Status) => s.level !== 'fine';
