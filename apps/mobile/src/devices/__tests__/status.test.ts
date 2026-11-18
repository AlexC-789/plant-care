import type { Device } from '@/devices/api';
import { deviceStatus, needsYou, soilLabel, timeLabel, waterLabel } from '@/devices/status';

const now = new Date('2026-11-18T12:00:00');
const minsAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();
const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const dev = (over: Partial<Device> = {}): Device => ({
  id: 'd1',
  plant_id: 'p1',
  created_at: minsAgo(1000),
  last_seen_at: minsAgo(10),
  sync_interval_s: 3600,
  reading_ts: minsAgo(10),
  soil_pct: 45,
  water_left_ml: 500,
  float_low: false,
  battery_pct: 80,
  charging: false,
  fault_code: null,
  tank_full_ml: 705,
  resumePending: false,
  ...over,
});

describe('deviceStatus', () => {
  it('setup: no module', () => {
    expect(deviceStatus(null, now)).toEqual({
      key: 'setup',
      level: 'quiet',
      line: "Setup isn't finished · Add its module",
      banner: null,
    });
  });

  it('fault no_moisture_rise', () => {
    expect(deviceStatus(dev({ fault_code: 'no_moisture_rise' }), now)).toEqual({
      key: 'fault',
      level: 'now',
      line: 'Watering stopped · Check the stake is in the soil',
      banner: "Watering stopped. Check the stake is in the soil and the tube isn't kinked, then resume.",
    });
  });

  it('fault sensor_out_of_range', () => {
    expect(deviceStatus(dev({ fault_code: 'sensor_out_of_range' }), now).banner).toBe(
      'Watering stopped. Check the stake is pushed into the soil; it resumes by itself.',
    );
  });

  it('tank', () => {
    expect(deviceStatus(dev({ float_low: true }), now)).toEqual({
      key: 'tank',
      level: 'now',
      line: 'Tank needs refilling',
      banner: "The tank needs refilling. Watering is paused until it's filled.",
    });
  });

  it('offline', () => {
    const seen = minsAgo(300);
    expect(deviceStatus(dev({ last_seen_at: seen }), now)).toEqual({
      key: 'offline',
      level: 'quiet',
      line: `Not heard from since ${timeLabel(seen, now)}`,
      banner: `Not heard from since ${timeLabel(seen, now)}. It should keep watering on its last instructions.`,
    });
  });

  it('offline with a low battery is Now', () => {
    const seen = minsAgo(300);
    const s = deviceStatus(dev({ last_seen_at: seen, battery_pct: 12 }), now);
    expect(s.level).toBe('now');
    expect(s.line).toBe(`Not heard from since ${timeLabel(seen, now)} · Its battery was low`);
  });

  it('waiting: a claimed module without readings is waiting, not fine', () => {
    expect(deviceStatus(dev({ reading_ts: null, soil_pct: null, battery_pct: null }), now)).toEqual({
      key: 'waiting',
      level: 'quiet',
      line: 'Waiting for its first check-in',
      banner: null,
    });
  });

  it('wet', () => {
    expect(deviceStatus(dev({ soil_pct: 70 }), now)).toEqual({
      key: 'wet',
      level: 'soon',
      line: 'Soil is very wet · Watering is on hold',
      banner: null,
    });
  });

  it('battery', () => {
    expect(deviceStatus(dev({ battery_pct: 15 }), now)).toEqual({
      key: 'battery',
      level: 'soon',
      line: 'Battery is low · Charge it this week',
      banner: 'Battery is low. Charge it this week.',
    });
  });

  it('fine', () => {
    expect(deviceStatus(dev(), now)).toEqual({
      key: 'fine',
      level: 'fine',
      line: 'Doing well · Still learning how fast it drinks',
      banner: null,
    });
  });

  it('order: fault beats tank beats offline; offline beats waiting', () => {
    const stale = { last_seen_at: minsAgo(300) };
    expect(deviceStatus(dev({ fault_code: 'no_moisture_rise', float_low: true, ...stale }), now).key).toBe('fault');
    expect(deviceStatus(dev({ float_low: true, ...stale }), now).key).toBe('tank');
    expect(deviceStatus(dev({ reading_ts: null, ...stale }), now).key).toBe('offline');
  });

  it('offline threshold follows sync_interval_s', () => {
    expect(deviceStatus(dev({ last_seen_at: minsAgo(181) }), now).key).toBe('offline');
    expect(deviceStatus(dev({ last_seen_at: minsAgo(179) }), now).key).toBe('fine');
    expect(deviceStatus(dev({ sync_interval_s: 10_800, last_seen_at: minsAgo(240) }), now).key).toBe('fine');
  });
});

describe('timeLabel', () => {
  it('today shows the time, within 6 days the weekday, else the date', () => {
    const today = minsAgo(90);
    expect(timeLabel(today, now)).toBe(time(today));
    const d3 = new Date(now.getTime() - 3 * 86_400_000).toISOString();
    expect(timeLabel(d3, now)).toBe(new Date(d3).toLocaleDateString([], { weekday: 'long' }));
    const d20 = new Date(now.getTime() - 20 * 86_400_000).toISOString();
    expect(timeLabel(d20, now)).toBe(new Date(d20).toLocaleDateString([], { day: 'numeric', month: 'short' }));
  });
});

describe('labels', () => {
  it('soilLabel by band', () => {
    expect(soilLabel(28)).toBe('Dry · 28 %');
    expect(soilLabel(35)).toBe('Damp · 35 %');
    expect(soilLabel(55)).toBe('Damp · 55 %');
    expect(soilLabel(70)).toBe('Very wet · 70 %');
    expect(soilLabel(null)).toBe('—');
  });

  it('waterLabel rounds to 50 ml', () => {
    expect(waterLabel(dev({ water_left_ml: 512 }))).toBe('About 500 ml left');
    expect(waterLabel(dev({ water_left_ml: 537 }))).toBe('About 550 ml left');
    expect(waterLabel(dev({ float_low: true }))).toBe('Needs refilling');
    expect(waterLabel(dev({ water_left_ml: null }))).toBe('—');
  });

  it('needsYou is false only for fine', () => {
    expect(needsYou(deviceStatus(dev(), now))).toBe(false);
    expect(needsYou(deviceStatus(null, now))).toBe(true);
  });
});
