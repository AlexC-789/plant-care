import type { Device } from '@/devices/api';
import { deviceStatus, needsYou, soilLabel, timeLabel } from '@/devices/status';

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

// UX_ARCHITECTURE §6: one sentence per plant, no middle dots; red (now) only for fault and tank.
describe('deviceStatus', () => {
  it('no module is a finished state: doing well', () => {
    expect(deviceStatus(null, now)).toEqual({
      key: 'setup',
      level: 'fine',
      line: 'No module',
      headline: 'No module yet',
      detail: 'Photos and health checks only. Set up a module to water it automatically.',
    });
  });

  it('fault no_moisture_rise', () => {
    expect(deviceStatus(dev({ fault_code: 'no_moisture_rise' }), now)).toEqual({
      key: 'fault',
      level: 'now',
      line: 'Watering stopped',
      headline: 'Watering stopped',
      detail: "Check the stake is in the soil and the tube isn't kinked, then resume.",
    });
  });

  it('fault sensor_out_of_range', () => {
    expect(deviceStatus(dev({ fault_code: 'sensor_out_of_range' }), now).detail).toBe(
      'Check the stake is pushed into the soil. It resumes by itself.',
    );
  });

  it('tank', () => {
    expect(deviceStatus(dev({ float_low: true }), now)).toEqual({
      key: 'tank',
      level: 'now',
      line: 'Tank needs refilling',
      headline: 'Tank needs refilling',
      detail: 'Watering is paused. It starts again by itself once you top it up.',
    });
  });

  it('offline needs you, in ink, even with a low battery', () => {
    const seen = minsAgo(300);
    const t = timeLabel(seen, now);
    const expected = {
      key: 'offline',
      level: 'soon',
      line: `Not heard from since ${t}`,
      headline: `Not heard from since ${t}`,
      detail: 'It may be out of Wi-Fi range or its battery may be flat.',
    };
    expect(deviceStatus(dev({ last_seen_at: seen }), now)).toEqual(expected);
    expect(deviceStatus(dev({ last_seen_at: seen, battery_pct: 12 }), now)).toEqual(expected);
  });

  it('waiting: a claimed module without readings is waiting, doing well', () => {
    expect(deviceStatus(dev({ reading_ts: null, soil_pct: null, battery_pct: null }), now)).toEqual({
      key: 'waiting',
      level: 'fine',
      line: 'Waiting for its first check-in',
      headline: 'Waiting for its first check-in',
      detail: 'This can take a few minutes after setup.',
    });
  });

  it('wet is doing well: the module handles it', () => {
    expect(deviceStatus(dev({ soil_pct: 70 }), now)).toEqual({
      key: 'wet',
      level: 'fine',
      line: 'Soil is very wet',
      headline: 'Soil is very wet',
      detail: 'Watering is on hold until it dries a little.',
    });
  });

  it('battery', () => {
    expect(deviceStatus(dev({ battery_pct: 15 }), now)).toEqual({
      key: 'battery',
      level: 'soon',
      line: 'Battery low',
      headline: 'Battery low',
      detail: 'Charge the module in the next few days.',
    });
  });

  it('fine', () => {
    expect(deviceStatus(dev(), now)).toEqual({
      key: 'fine',
      level: 'fine',
      line: 'Learning how fast it drinks',
      headline: 'Learning how fast it drinks',
      detail: 'It waters itself when the soil starts to dry.',
    });
  });

  it('no copy uses a middle dot', () => {
    const cases = [
      null,
      dev(),
      dev({ fault_code: 'no_moisture_rise' }),
      dev({ float_low: true }),
      dev({ last_seen_at: minsAgo(300), battery_pct: 5 }),
      dev({ soil_pct: 70 }),
      dev({ battery_pct: 5 }),
    ];
    for (const d of cases) expect(JSON.stringify(deviceStatus(d, now))).not.toContain('·');
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
  it('soilLabel by band, with a comma', () => {
    expect(soilLabel(28)).toBe('Dry, 28 %');
    expect(soilLabel(52.9)).toBe('Damp, 53 %');
    expect(soilLabel(35)).toBe('Damp, 35 %');
    expect(soilLabel(55)).toBe('Damp, 55 %');
    expect(soilLabel(70)).toBe('Very wet, 70 %');
    expect(soilLabel(null)).toBe('—');
  });

  it('needsYou: fault, tank, offline and battery; not no module, waiting, wet or fine', () => {
    expect(needsYou(deviceStatus(dev({ battery_pct: 5 }), now))).toBe(true);
    expect(needsYou(deviceStatus(dev({ last_seen_at: minsAgo(300) }), now))).toBe(true);
    for (const d of [null, dev(), dev({ soil_pct: 70 }), dev({ reading_ts: null })]) {
      expect(needsYou(deviceStatus(d, now))).toBe(false);
    }
  });
});
