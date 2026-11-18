import { assert, assertEquals } from '@std/assert';

import { batteryPct, instructionsFor, soilPct, waterLeftMl, wateredMl, type Calibration } from './twin.ts';
import { DEFAULT_INSTRUCTIONS, LIMITS } from './watering.ts';

const C: Calibration = {
  soil_air_raw: 2900, soil_wet_raw: 1200, tank_empty_raw: 1000, tank_full_raw: 3000, tank_full_ml: 705, pump_ml_per_s: 3,
};

Deno.test('soilPct: air reads 0, wet reads 100, midpoint 50, beyond clamps', () => {
  assertEquals(soilPct(2900, C), 0);
  assertEquals(soilPct(1200, C), 100);
  assertEquals(soilPct(2050, C), 50);
  assertEquals(soilPct(3300, C), 0);
  assertEquals(soilPct(500, C), 100);
});

Deno.test('waterLeftMl: empty 0, full 705, half ~353; 3 % past full clamps; 10 % past is null', () => {
  assertEquals(waterLeftMl(1000, C), 0);
  assertEquals(waterLeftMl(3000, C), 705);
  assertEquals(waterLeftMl(2000, C), 353);
  assertEquals(waterLeftMl(3060, C), 705);
  assertEquals(waterLeftMl(3200, C), null);
});

Deno.test('batteryPct follows the table', () => {
  assertEquals(batteryPct(4200), 100);
  assertEquals(batteryPct(3650), 20);
  assertEquals(batteryPct(3625), 15);
  assertEquals(batteryPct(3000), 0);
  assertEquals(batteryPct(5000), 100);
});

Deno.test('wateredMl: 10 000 ms at 3.0 ml/s is 30', () => {
  assertEquals(wateredMl(10_000, C), 30);
});

Deno.test('default instructions: threshold 2305, pump 10 000 ms, 60 min, 900 s, 3600 s', () => {
  assertEquals(instructionsFor(C, 80), {
    water_when_soil_raw_above: 2305, pump_ms: 10_000, min_minutes_between_doses: 60, read_interval_s: 900, sync_interval_s: 3600,
  });
});

Deno.test('low battery stretches sync to 3 h', () => {
  assertEquals(instructionsFor(C, 19).sync_interval_s, 10_800);
  assertEquals(instructionsFor(C, 20).sync_interval_s, 3600);
  assertEquals(instructionsFor(C, null).sync_interval_s, 3600);
});

Deno.test('a slow calibrated pump still never exceeds the compiled dose cap', () => {
  assertEquals(instructionsFor({ ...C, pump_ml_per_s: 1 }, 80).pump_ms, 10_000);
});

Deno.test('degenerate calibration gives null, not NaN', () => {
  assertEquals(soilPct(2000, { ...C, soil_air_raw: 2000, soil_wet_raw: 2000 }), null);
  assertEquals(waterLeftMl(2000, { ...C, tank_full_raw: 1000 }), null);
  for (const c of [{ ...C, soil_wet_raw: C.soil_air_raw }, { ...C, pump_ml_per_s: 0 }, { ...C, pump_ml_per_s: NaN }]) {
    const i = instructionsFor(c, 80);
    for (const v of Object.values(i)) assert(Number.isFinite(v));
    assert(i.pump_ms <= LIMITS.maxDosePumpMs);
    assertEquals(i.water_when_soil_raw_above, DEFAULT_INSTRUCTIONS.water_when_soil_raw_above);
  }
});
