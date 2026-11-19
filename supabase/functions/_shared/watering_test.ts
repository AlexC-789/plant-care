import { assert, assertEquals } from '@std/assert';

import {
  afterSync, clampInstructions, clearFault, DEFAULT_INSTRUCTIONS, freshState, LIMITS, newState, nextSyncDelayS, wake,
  type Instructions, type ModuleState, type RawReading,
} from './watering.ts';

const T0 = Date.UTC(2026, 10, 18, 8, 0, 0);
const MIN = 60_000;
const H = 60 * MIN;
const reading = (o: Partial<RawReading> = {}, now = T0): RawReading => ({
  ts: new Date(now).toISOString(), soil_raw: 3000, tank_raw: 2000, float_low: false, battery_mv: 4000, charging: false, ...o,
});
const withInstr = (s: ModuleState, i: Partial<Instructions>): ModuleState => ({ ...s, instructions: { ...s.instructions, ...i } });

Deno.test('waters when soil is drier than the threshold', () => {
  const r = wake(newState(), reading(), T0);
  assertEquals(r.pumpMs, DEFAULT_INSTRUCTIONS.pump_ms);
  assertEquals(r.events.find((e) => e.type === 'watered')?.pump_ms, DEFAULT_INSTRUCTIONS.pump_ms);
  assertEquals(r.state.doses.length, 1);
});

Deno.test('never pumps while the float reads low', () => {
  const r = wake(newState(), reading({ float_low: true }), T0);
  assertEquals(r.pumpMs, 0);
});

Deno.test('caps a dose at 10 s whatever the instructions say', () => {
  const r = wake(withInstr(newState(), { pump_ms: 60_000 }), reading(), T0);
  assertEquals(r.pumpMs, 10_000);
});

Deno.test('stops at 37.5 s of pumping per rolling 24 h', () => {
  let s = withInstr(newState(), { pump_ms: 10_000 });
  const got: number[] = [];
  for (let i = 0; i < 5; i++) {
    const now = T0 + i * 2 * H;
    const r = wake(s, reading({ soil_raw: 3400 - 40 * i }, now), now); // each wake is a rise after the last dose
    got.push(r.pumpMs);
    s = r.state;
  }
  assertEquals(got, [10_000, 10_000, 10_000, 7_500, 0]);
  const now = T0 + 24 * H;
  assert(wake(s, reading({ soil_raw: 2900 }, now), now).pumpMs > 0);
});

Deno.test('waits min_minutes_between_doses', () => {
  const s = withInstr(newState(), { min_minutes_between_doses: 60 });
  const a = wake(s, reading({ soil_raw: 3000 }), T0);
  assertEquals(a.pumpMs, 5000);
  const b = wake(a.state, reading({ soil_raw: 2900 }, T0 + 59 * MIN), T0 + 59 * MIN);
  assertEquals(b.pumpMs, 0);
  const c = wake(b.state, reading({ soil_raw: 2800 }, T0 + 61 * MIN), T0 + 61 * MIN);
  assertEquals(c.pumpMs, 5000);
});

Deno.test('two doses with no moisture rise raise no_moisture_rise and stop watering', () => {
  const w = (s: ModuleState, i: number) => wake(s, reading({}, T0 + i * 2 * H), T0 + i * 2 * H);
  const a = w(newState(), 0);
  const b = w(a.state, 1);
  assertEquals(b.pumpMs, 5000);
  assertEquals(b.state.fault, null);
  const c = w(b.state, 2);
  assertEquals(c.pumpMs, 0);
  assertEquals(c.state.fault, 'no_moisture_rise');
  assertEquals(c.events.find((e) => e.type === 'fault')?.code, 'no_moisture_rise');
  assert(c.syncNow);
  const d = w(c.state, 3);
  assertEquals(d.pumpMs, 0);
  assertEquals(d.events.length, 0);
});

Deno.test('a rise resets the no-rise count', () => {
  const w = (s: ModuleState, i: number, soil: number) => wake(s, reading({ soil_raw: soil }, T0 + i * 2 * H), T0 + i * 2 * H);
  const a = w(newState(), 0, 3000);
  const b = w(a.state, 1, 3000); // no rise: count 1, doses again
  assertEquals(b.state.noRiseCount, 1);
  const c = w(b.state, 2, 2900); // rise: reset, doses again
  assertEquals(c.state.noRiseCount, 0);
  assertEquals(c.state.fault, null);
  assertEquals(c.pumpMs, 5000);
});

Deno.test('clearFault resumes watering', () => {
  let s = newState();
  for (let i = 0; i < 3; i++) s = wake(s, reading({}, T0 + i * 2 * H), T0 + i * 2 * H).state;
  assertEquals(s.fault, 'no_moisture_rise');
  const cleared = clearFault(s);
  assertEquals([cleared.fault, cleared.noRiseCount], [null, 0]);
  const now = T0 + 7 * H;
  assertEquals(wake(cleared, reading({}, now), now).pumpMs, 5000);
});

Deno.test('sensor out of range: no watering, fault, clears itself when back in range', () => {
  const a = wake(newState(), reading({ soil_raw: 4000 }), T0);
  assertEquals(a.pumpMs, 0);
  assertEquals(a.state.fault, 'sensor_out_of_range');
  assertEquals(a.events.find((e) => e.type === 'fault')?.code, 'sensor_out_of_range');
  assert(a.syncNow);
  const low = wake(a.state, reading({ soil_raw: 100 }, T0 + H), T0 + H);
  assertEquals(low.events.length, 0); // not newly raised
  const b = wake(a.state, reading({ soil_raw: 3000 }, T0 + 2 * H), T0 + 2 * H);
  assertEquals(b.state.fault, null);
  // does not clear no_moisture_rise
  const stuck: ModuleState = { ...newState(), fault: 'no_moisture_rise', noRiseCount: 2 };
  const c = wake(stuck, reading({ soil_raw: 3000 }), T0);
  assertEquals(c.state.fault, 'no_moisture_rise');
  assertEquals(c.pumpMs, 0);
  // out of range while no_moisture_rise keeps it too
  assertEquals(wake(stuck, reading({ soil_raw: 4000 }), T0).state.fault, 'no_moisture_rise');
});

Deno.test('refill, tank low and low battery emit events and ask for an early sync', () => {
  const calm = wake(newState(), reading({ soil_raw: 1000 }), T0);
  assertEquals(calm.events.length, 0);
  assertEquals(calm.syncNow, false);
  const base = calm.state;
  const tankLow = wake(base, reading({ soil_raw: 1000, float_low: true }, T0 + H), T0 + H);
  assertEquals(tankLow.events.map((e) => e.type), ['tank_low']);
  assert(tankLow.syncNow);
  const refill = wake(base, reading({ soil_raw: 1000, tank_raw: 2000 + LIMITS.refillRiseRaw }, T0 + H), T0 + H);
  assertEquals(refill.events.map((e) => e.type), ['refill_detected']);
  const bat = wake(base, reading({ soil_raw: 1000, battery_mv: 3600 }, T0 + H), T0 + H);
  assertEquals(bat.events.map((e) => e.type), ['battery_low']);
  assert(bat.syncNow);
  // already low: no repeat
  assertEquals(wake(bat.state, reading({ soil_raw: 1000, battery_mv: 3590 }, T0 + 2 * H), T0 + 2 * H).events.length, 0);
});

Deno.test('newState waters on the first dry wake', () => {
  assertEquals(newState().doses.length, 0);
  assertEquals(wake(newState(), reading(), T0).pumpMs, 5000);
});

Deno.test('freshState treats the 24 h budget as used up', () => {
  const s = freshState(T0);
  assertEquals(wake(s, reading(), T0).pumpMs, 0);
  const later = T0 + 24 * H + MIN;
  assertEquals(wake(s, reading({}, later), later).pumpMs, 5000);
});

Deno.test('a restored state keeps budget and fault', () => {
  const rt = (st: ModuleState): ModuleState => JSON.parse(JSON.stringify(st));
  const dosed = (ms: number) => rt({ ...newState(), doses: [{ at: T0 - 3 * H, pump_ms: ms }] });
  assertEquals(wake(dosed(LIMITS.maxDayPumpMs), reading(), T0).pumpMs, 0);
  assertEquals(wake(dosed(30_000), reading(), T0).pumpMs, 5000);
  assertEquals(wake(dosed(35_000), reading(), T0).pumpMs, 2500);
  assertEquals(wake(rt({ ...newState(), fault: 'no_moisture_rise' }), reading(), T0).pumpMs, 0);
  assertEquals(wake(rt(freshState(T0)), reading(), T0 + H).pumpMs, 0);
  // a state saved right after a real dose still enforces the budget
  const after = rt(wake(withInstr(newState(), { pump_ms: 10_000 }), reading(), T0).state);
  assertEquals(after.doses.length, 1);
  assertEquals(wake(after, reading({ soil_raw: 2900 }, T0 + 3 * H), T0 + 3 * H).pumpMs, 10_000);
});

Deno.test('an out-of-range glitch reading is not a moisture rise', () => {
  const w = (s: ModuleState, i: number, soil: number) => wake(s, reading({ soil_raw: soil }, T0 + i * 2 * H), T0 + i * 2 * H);
  let s = w(newState(), 0, 3000).state;
  s = w(s, 1, 3000).state; // no rise: count 1, doses again
  const g = w(s, 2, 0); // probe glitch at the rise check
  assertEquals(g.state.noRiseCount, 2);
  assertEquals(g.state.fault, 'no_moisture_rise');
  assertEquals(g.pumpMs, 0);
});

Deno.test('a missing float_low reading never pumps', () => {
  const r = wake(newState(), { ...reading(), float_low: undefined as unknown as boolean }, T0);
  assertEquals(r.pumpMs, 0);
});

Deno.test('non-finite min_minutes_between_doses falls back to the default', () => {
  assertEquals(clampInstructions({ ...DEFAULT_INSTRUCTIONS, min_minutes_between_doses: NaN }).min_minutes_between_doses, 120);
  const s = withInstr(newState(), { min_minutes_between_doses: null as unknown as number });
  const a = wake(s, reading(), T0);
  assertEquals(wake(a.state, reading({ soil_raw: 2900 }, T0 + MIN), T0 + MIN).pumpMs, 0);
});

Deno.test('clampInstructions keeps intervals inside compiled bounds', () => {
  const c = (o: Partial<Instructions>) => clampInstructions({ ...DEFAULT_INSTRUCTIONS, ...o });
  assertEquals(c({ read_interval_s: 1 }).read_interval_s, 300);
  assertEquals(c({ read_interval_s: 99_999 }).read_interval_s, 3600);
  assertEquals(c({ sync_interval_s: 10 }).sync_interval_s, 900);
  assertEquals(c({ sync_interval_s: 99_999 }).sync_interval_s, 21_600);
  assertEquals(c({ pump_ms: 60_000 }).pump_ms, 10_000);
  assertEquals(c({ pump_ms: -5 }).pump_ms, 0);
  assertEquals(c({ min_minutes_between_doses: -5 }).min_minutes_between_doses, 0);
});

Deno.test('garbage instructions never produce a dose over the limits', () => {
  for (const pump_ms of [NaN, -1, Infinity, 1e12]) {
    const r = wake(withInstr(newState(), { pump_ms }), reading(), T0);
    assert(r.pumpMs >= 0 && r.pumpMs <= 10_000 && Number.isFinite(r.pumpMs));
  }
});

Deno.test('backoff after failed syncs is 1, 2, 4, then 6 h; success resets', () => {
  let s = newState();
  assertEquals(nextSyncDelayS(s), 3600);
  const got: number[] = [];
  for (let i = 0; i < 5; i++) {
    s = afterSync(s, false);
    got.push(nextSyncDelayS(s));
  }
  assertEquals(got, [3600, 7200, 14_400, 21_600, 21_600]);
  s = afterSync(s, true, { ...DEFAULT_INSTRUCTIONS, sync_interval_s: 10, pump_ms: 99_999 });
  assertEquals(s.failedSyncs, 0);
  assertEquals(s.instructions.pump_ms, 10_000);
  assertEquals(nextSyncDelayS(s), 900);
});
