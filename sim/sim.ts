// Plant Care module simulator: plays a watering module on this PC (claims a code, wakes and syncs on
// schedule, runs the shared watering rules unchanged). Node 22+, no dependencies.
//
//   node sim/sim.ts --claim <code> [--name pot1] [--url <supabase url>] [--from 1d|6h] [--speed 600]
//                   [--scenario normal|drought|tank-empty|offline-6h|stake-out-of-soil|battery-low]
//   node sim/sim.ts --name pot1            resume a claimed module (state in sim/.devices/<name>.json)
//
// --url defaults to the active EXPO_PUBLIC_SUPABASE_URL in apps/mobile/.env.local (pass the local URL
// explicitly to avoid the hosted project). --from starts the sim clock in the past; --speed N runs
// N x faster until it catches up with real time. --scenario applies to the run (offline-6h) or a new claim.
// Keys (terminal only): f = fill the tank, h = add half a tank, q = quit.
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import {
  type DeviceEvent, type ModuleState, type RawReading,
  afterSync, clearFault, freshState, newState, nextSyncDelayS, wake,
} from '../supabase/functions/_shared/watering.ts';
import { type Scenario, type World, advance, fill, initialWorld, offline, pump, readSensors } from './model.ts';

const FIRMWARE = 'sim-0.1.0';
const here = new URL('.', import.meta.url);
const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
const die = (m: string): never => { console.error(m); process.exit(1); };

const name = args.get('name') ?? 'pot1';
if (!/^[\w-]+$/.test(name)) die('Bad --name.');
const speed = Number(args.get('speed') ?? 1);
if (!(speed > 0)) die('Bad --speed.');
const scenario = (args.get('scenario') ?? 'normal') as Scenario;
if (!['normal', 'drought', 'tank-empty', 'offline-6h', 'stake-out-of-soil', 'battery-low'].includes(scenario)) die('Bad --scenario.');
const fromM = (args.get('from') ?? '0d').match(/^(\d+(?:\.\d+)?)([dh])$/);
if (!fromM) die('Bad --from (use 1d or 6h).');
const fromMs = Number(fromM![1]) * (fromM![2] === 'd' ? 24 : 1) * 3_600_000;

const dir = new URL('.devices/', here);
const file = new URL(`${name}.json`, dir);
interface Saved { url: string; device_id: string; secret: string; state?: ModuleState; world?: World; simNow?: number }

async function post(url: string, body: unknown, secret?: string) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(secret ? { authorization: `Bearer ${secret}` } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

let saved: Saved;
let simNow: number;
let world: World;
let state: ModuleState;
if (args.has('claim')) {
  const url = args.get('url') ??
    readFileSync(new URL('../apps/mobile/.env.local', here), 'utf8').match(/^EXPO_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1].trim() ?? die('No --url.');
  const r = await post(`${url}/functions/v1/device-claim`, { code: args.get('claim'), firmware_version: FIRMWARE });
  if (r.status !== 200) die(`Claim failed (${r.status}): ${r.json?.error ?? 'unknown'}`);
  saved = { url, device_id: r.json.device_id, secret: r.json.secret };
  simNow = Date.now() - fromMs;
  world = initialWorld(scenario);
  state = newState();
  console.log(`Claimed device ${saved.device_id} as "${name}".`);
} else {
  try { saved = JSON.parse(readFileSync(file, 'utf8')); } catch { die(`No saved module "${name}"; use --claim <code>.`); }
  simNow = args.has('from') ? Date.now() - fromMs : saved!.simNow ?? Date.now();
  world = saved!.world ?? initialWorld(scenario);
  // Lost or unreadable state: assume the daily budget is used up.
  state = saved!.state?.instructions ? saved!.state : freshState(simNow);
}
const simStart = simNow;

const save = () => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, JSON.stringify({ url: saved.url, device_id: saved.device_id, secret: saved.secret, state, world, simNow }, null, 2));
};

const readings: RawReading[] = [];
let events: DeviceEvent[] = [{ ts: new Date(simNow).toISOString(), type: 'boot' }]; // power-up
let acked: string[] = [];
let lastSync = -Infinity;
let gone = 0;
let syncNow = true; // boot sync
let quit = false;
let nudge: (() => void) | null = null;
const keys: string[] = [];

if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', (d) => {
    const k = String(d);
    if (k === 'q' || k === '\x03') quit = true;
    else if (k === 'f' || k === 'h') keys.push(k);
    nudge?.();
  });
}

async function sync(): Promise<void> {
  const sentR = readings.length, sentE = events.length, sentA = acked.length;
  const body = { firmware_version: FIRMWARE, fault: state.fault, readings: readings.slice(), events: events.slice(), acked: acked.slice() };
  let status = 0, json: any = null;
  if (!offline(scenario, simStart, simNow)) {
    try { ({ status, json } = await post(`${saved.url}/functions/v1/device-sync`, body, saved.secret)); } catch { /* network down */ }
  }
  lastSync = simNow;
  if (status === 410) {
    if (++gone >= 2) {
      rmSync(file, { force: true });
      console.log('Removed from its plant; forgot its secret.');
      process.exit(0);
    }
  } else gone = 0;
  if (status === 200) {
    readings.splice(0, sentR); events.splice(0, sentE); acked.splice(0, sentA);
    for (const c of json.commands ?? []) {
      if (c.type === 'clear_fault') state = clearFault(state);
      acked.push(c.id);
    }
    state = afterSync(state, true, json.instructions);
  } else state = afterSync(state, false);
  console.log(`${new Date(simNow).toISOString()} sync ${status || 'offline'} sent ${sentR} readings ${sentE} events, next in ${nextSyncDelayS(state)}s`);
}

while (!quit) {
  const key = keys.shift();
  if (key === 'f') world = fill(world, 1);
  if (key === 'h') world = fill(world, 0.5);

  const reading = readSensors(world, new Date(simNow).toISOString());
  const out = wake(state, reading, simNow);
  state = out.state;
  save(); // before the pump, so a crash mid-dose keeps the dose record
  world = pump(world, out.pumpMs);
  readings.push(reading); if (readings.length > 192) readings.shift();
  events.push(...out.events); if (events.length > 100) events.splice(0, events.length - 100);
  console.log(`${reading.ts} wake soil ${reading.soil_raw} tank ${reading.tank_raw}${reading.float_low ? ' (low)' : ''} ${reading.battery_mv} mV` +
    (out.pumpMs ? ` PUMP ${out.pumpMs} ms` : '') + (state.fault ? ` FAULT ${state.fault}` : ''));

  if (syncNow || out.syncNow || simNow - lastSync >= nextSyncDelayS(state) * 1000) await sync();
  syncNow = false;
  save();

  // Sleep one read interval: fast while catching up, real time afterwards; a key press cuts it short.
  const stepS = state.instructions.read_interval_s;
  const behind = simNow + stepS * 1000 <= Date.now();
  const hours = stepS / 3600;
  simNow += stepS * 1000;
  world = advance(world, hours);
  if (keys.length === 0 && !quit) {
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, (behind ? stepS / speed : stepS) * 1000);
      nudge = () => { clearTimeout(t); resolve(); };
    });
    nudge = null;
  }
}
process.exit(0);
