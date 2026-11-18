// Manual browser proofs for spec §8a.3 (no EXIF GPS stored), §8a.8 (delete leaves no objects) and
// §8a.2 (bucket rejects PNG and > 3 MB). Needs local Supabase + `expo start --web --port 8081`.
// Run: SUPABASE_URL=… SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… node apps/mobile/e2e/m2-security.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
// Playwright is preinstalled globally, not a project dependency.
const { chromium } = require('playwright');

const API = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP = process.env.APP_URL ?? 'http://localhost:8081';
if (!ANON || !SERVICE) throw new Error('Set SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY');
const FIXTURE = fileURLToPath(new URL('./fixtures/gps-plant.jpg', import.meta.url));

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`);
  if (!ok) failed++;
};

const call = (path, { key = SERVICE, token = key, ...init } = {}) =>
  fetch(`${API}${path}`, { ...init, headers: { apikey: key, authorization: `Bearer ${token}`, ...init.headers } });

/** True when an APP1 Exif segment holds the GPS IFD pointer tag 0x8825 (either byte order). Entropy data is not scanned. */
export function hasExifGps(buf) {
  let i = 2;
  while (i + 4 <= buf.length && buf[i] === 0xff && buf[i + 1] !== 0xda) {
    const len = buf.readUInt16BE(i + 2);
    const seg = buf.subarray(i + 4, i + 2 + len);
    if (buf[i + 1] === 0xe1 && seg.subarray(0, 6).toString('latin1') === 'Exif\0\0') {
      for (let j = 0; j + 1 < seg.length; j++) {
        if ((seg[j] === 0x88 && seg[j + 1] === 0x25) || (seg[j] === 0x25 && seg[j + 1] === 0x88)) return true;
      }
    }
    i += 2 + len;
  }
  return false;
}

const listObjects = async (uid) =>
  (await (await call('/storage/v1/object/list/plant-photos', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prefix: uid, limit: 100 }),
  })).json()).map((o) => `${uid}/${o.name}`);

async function main() {
  const email = `e2e-${randomUUID().slice(0, 8)}@example.com`;
  const password = 'e2e-password-1';
  const created = await (await call('/auth/v1/admin/users', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true }),
  })).json();
  const uid = created.id;
  if (!uid) throw new Error(`could not create user: ${JSON.stringify(created)}`);

  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  try {
    // (a) add a plant with the GPS-tagged fixture through the real add steps (photo, skip identify, where, skip health)
    check('fixture contains the EXIF GPS tag', hasExifGps(readFileSync(FIXTURE)));
    await page.goto(APP);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByRole('button', { name: 'Add a pot' }).first().click();
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Choose from library' }).first().click();
    await (await chooser).setFiles(FIXTURE);
    await page.getByRole('button', { name: 'Remove' }).waitFor(); // appears once the photo is uploaded
    const [stored] = await listObjects(uid);
    const bytes = Buffer.from(await (await call(`/storage/v1/object/plant-photos/${stored}`)).arrayBuffer());
    check('stored photo is a JPEG', bytes[0] === 0xff && bytes[1] === 0xd8, stored);
    check('stored photo has no EXIF GPS tag', !hasExifGps(bytes), `${bytes.length} bytes`);

    // (b) delete a plant that has a photo and scan photos; no objects may remain
    // Earlier steps stay mounted (hidden) in the stack, so click the visible Continue.
    const next = () => page.locator('role=button[name="Continue"] >> visible=true').click();
    await next(); // step 1 -> 2
    await page.getByText('What kind of plant is it?').waitFor(); // else the next click can hit step 1 mid-transition
    await next(); // step 2 (no identify) -> 3
    await page.getByLabel('Nickname').fill('E2E Fern');
    await next(); // saves, then step 4
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await page.getByRole('button', { name: 'More options' }).waitFor();
    const plant = (await (await call(`/rest/v1/plants?select=id,photo_path&user_id=eq.${uid}`, { headers: { accept: 'application/json' } })).json())[0];
    const scanPaths = [`${uid}/${randomUUID()}.jpg`, `${uid}/${randomUUID()}.jpg`];
    for (const p of scanPaths) {
      await call(`/storage/v1/object/plant-photos/${p}`, { method: 'POST', headers: { 'content-type': 'image/jpeg' }, body: readFileSync(FIXTURE) });
    }
    await call('/rest/v1/scans', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify([
        { user_id: uid, plant_id: plant.id, kind: 'health', status: 'ok', photo_paths: [scanPaths[0]] },
        { user_id: uid, plant_id: plant.id, kind: 'identify', status: 'ok', photo_paths: [scanPaths[1]] },
      ]),
    });
    check('seeded 3 objects before delete', (await listObjects(uid)).length === 3);
    await page.getByRole('button', { name: 'More options' }).click();
    await page.getByRole('button', { name: 'Edit plant' }).click();
    await page.getByRole('button', { name: 'Delete plant' }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.getByText('No plants yet').waitFor();
    await page.waitForTimeout(1000);
    const left = await listObjects(uid);
    check('delete removed plant photo and scan photos', left.length === 0, left.join(',') || 'none left');
    const rows = await (await call(`/rest/v1/scans?select=id&user_id=eq.${uid}`)).json();
    check('delete removed scan rows', rows.length === 0);

    // (c) bucket rejects PNG and > 3 MB for an authenticated user
    const { access_token } = await (await call('/auth/v1/token?grant_type=password', {
      key: ANON,
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })).json();
    const upload = (name, type, body) =>
      call(`/storage/v1/object/plant-photos/${uid}/${name}`, { key: ANON, token: access_token, method: 'POST', headers: { 'content-type': type }, body });
    const ok = await upload(`${randomUUID()}.jpg`, 'image/jpeg', readFileSync(FIXTURE));
    check('control: small JPEG upload accepted', ok.ok, String(ok.status));
    const png = await upload(`${randomUUID()}.jpg`, 'image/png', Buffer.from('89504e470d0a1a0a', 'hex'));
    check('PNG upload rejected', !png.ok, String(png.status));
    const big = await upload(`${randomUUID()}.jpg`, 'image/jpeg', Buffer.alloc(3 * 1024 * 1024 + 1, 1));
    check('> 3 MB upload rejected', !big.ok, String(big.status));
  } finally {
    await browser.close();
    await call(`/auth/v1/admin/users/${uid}`, { method: 'DELETE' });
    for (const p of await listObjects(uid)) await call(`/storage/v1/object/plant-photos/${p}`, { method: 'DELETE' });
  }
}

await main().catch((e) => {
  console.log(`FAIL  ${e.message}`);
  failed++;
});
process.exit(failed ? 1 : 0);
