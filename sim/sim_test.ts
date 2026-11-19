import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SENSOR, advance, fill, initialWorld, nextWakeAt, offline, pump, readSensors } from './model.ts';
import { newState, wake } from '../supabase/functions/_shared/watering.ts';

const TS = '2026-01-01T00:00:00.000Z';

test('readSensors maps a full tank to tankFullRaw and 100 ml to float low', () => {
  const w = { ...initialWorld('normal'), tankMl: SENSOR.tankFullMl };
  const full = readSensors(w, TS);
  assert.ok(Math.abs(full.tank_raw - SENSOR.tankFullRaw) <= 20);
  assert.equal(full.float_low, false);
  assert.equal(readSensors({ ...w, tankMl: 100 }, TS).float_low, true);
  assert.equal(readSensors({ ...w, tankMl: 101 }, TS).float_low, false);
});

test('a stake out of soil reads air and a dose does not raise it', () => {
  const w = { ...initialWorld('stake-out-of-soil'), tankMl: 500 };
  const before = readSensors(w, TS).soil_raw;
  assert.ok(Math.abs(before - SENSOR.soilAirRaw) <= 20);
  const after = readSensors(pump(w, 5000), TS).soil_raw;
  assert.ok(Math.abs(after - before) <= 40);
});

test('pump drains the tank and wets the soil', () => {
  const w = { ...initialWorld('normal'), tankMl: 500 };
  const p = pump(w, 5000);
  assert.equal(p.tankMl, 500 - 15);
  assert.ok(p.soilPct > w.soilPct);
  assert.equal(pump({ ...w, tankMl: 5 }, 5000).tankMl, 0);
});

test('fill and offline', () => {
  const w = initialWorld('normal');
  assert.equal(fill(w, 1).tankMl, SENSOR.tankFullMl);
  assert.equal(fill(fill(w, 0.5), 0.5).tankMl, SENSOR.tankFullMl);
  assert.equal(offline('offline-6h', 0, 30 * 60_000), false);
  assert.equal(offline('offline-6h', 0, 2 * 3_600_000), true);
  assert.equal(offline('offline-6h', 0, 8 * 3_600_000), false);
  assert.equal(offline('normal', 0, 2 * 3_600_000), false);
});

function run(scenario: 'normal' | 'stake-out-of-soil', hours: number) {
  let w = { ...fill(initialWorld(scenario), 1) };
  let state = newState();
  let t = Date.UTC(2026, 0, 1);
  const pumped: { at: number; ml: number; ms: number; floatLow: boolean }[] = [];
  for (let i = 0; i < hours * 4; i++) {
    w = advance(w, 0.25);
    t += 15 * 60_000;
    const r = readSensors(w, new Date(t).toISOString());
    const out = wake(state, r, t);
    state = out.state;
    if (out.pumpMs > 0) pumped.push({ at: t, ml: out.pumpMs / 1000 * SENSOR.pumpMlPerS, ms: out.pumpMs, floatLow: r.float_low });
    w = pump(w, out.pumpMs);
  }
  return { state, pumped };
}

test('24 simulated hours of normal watering stay inside the limits', () => {
  const { pumped } = run('normal', 48);
  assert.ok(pumped.length > 0);
  for (const p of pumped) {
    assert.ok(p.ms <= 10_000 && p.ml <= 40);
    assert.equal(p.floatLow, false);
    assert.ok(pumped.filter((q) => q.at > p.at - 24 * 3_600_000 && q.at <= p.at).reduce((s, q) => s + q.ml, 0) <= 150);
  }
});

test('stake-out-of-soil faults after two doses', () => {
  const { state } = run('stake-out-of-soil', 6);
  assert.equal(state.fault, 'no_moisture_rise');
});

test('a key-press wake never runs ahead of real time', () => {
  const real = 1_000_000_000;
  assert.equal(nextWakeAt(real - 60_000, 900_000, real, true), real); // real-time mode: wake now, not +900 s
  assert.equal(nextWakeAt(real, 900_000, real, true), real);
  assert.equal(nextWakeAt(real - 86_400_000, 900_000, real, true), real - 86_400_000 + 900_000); // catching up
  assert.equal(nextWakeAt(real, 900_000, real, false), real + 900_000); // timer fired
});
