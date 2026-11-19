import { execFileSync, spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test as base, type Page } from '@playwright/test';
import type { Database } from '../src/lib/database.types';

export { expect };
export type TestUser = { id: string; email: string; password: string };
type DeviceRow = Partial<Database['public']['Tables']['devices']['Insert']>;

export const FIXTURE_JPEG = join(__dirname, 'fixtures/gps-plant.jpg');
const SIM = join(__dirname, '../../../sim/sim.ts');
const SIM_DEVICES = join(__dirname, '../../../sim/.devices');
const json = { 'content-type': 'application/json' };

/** True when an APP1 Exif segment holds the GPS IFD pointer tag 0x8825 (either byte order). Entropy data is not scanned. */
export function hasExifGps(buf: Buffer): boolean {
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

export class Admin {
  private key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  private api = process.env.SUPABASE_URL!;
  private made: TestUser[] = [];

  rest(path: string, init: RequestInit = {}): Promise<Response> {
    return fetch(`${this.api}${path}`, {
      ...init,
      headers: { apikey: this.key, authorization: `Bearer ${this.key}`, ...(init.headers as Record<string, string>) },
    });
  }

  // service_role has no INSERT on plants/plant_photos/devices (hosted-like grants), so seed through the DB container.
  private insert(table: string, row: object): { id: string } {
    const json = JSON.stringify(row).replaceAll("'", "''");
    const cols = Object.keys(JSON.parse(json.replaceAll("''", "'"))).join(', '); // undefined values drop out, so column defaults apply
    const out = execFileSync('docker', ['exec', '-i', 'supabase_db_plant-care', 'psql', '-U', 'postgres', '-tA', '-v', 'ON_ERROR_STOP=1'], {
      input: `insert into public.${table} (${cols}) select ${cols} from json_populate_record(null::public.${table}, '${json}') returning id;`,
      encoding: 'utf8',
    });
    return { id: out.trim().split(/\r?\n/)[0] };
  }

  async createUser(): Promise<TestUser> {
    const email = `e2e-${randomUUID().slice(0, 8)}@gmail.com`;
    const password = 'e2e-password-1';
    const r = await this.rest('/auth/v1/admin/users', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    const body = await r.json();
    if (!body.id) throw new Error(`createUser: ${JSON.stringify(body)}`);
    const u = { id: body.id as string, email, password };
    this.made.push(u);
    return u;
  }

  async deleteUser(u: TestUser): Promise<void> {
    for (const p of await this.listObjects(u.id)) await this.rest(`/storage/v1/object/plant-photos/${p}`, { method: 'DELETE' });
    await this.rest(`/auth/v1/admin/users/${u.id}`, { method: 'DELETE' });
  }

  async deleteMade(): Promise<void> {
    for (const u of this.made) await this.deleteUser(u);
  }

  private async upload(uid: string): Promise<string> {
    const path = `${uid}/${randomUUID()}.jpg`;
    const r = await this.rest(`/storage/v1/object/plant-photos/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'image/jpeg' },
      body: readFileSync(FIXTURE_JPEG),
    });
    if (!r.ok) throw new Error(`upload: ${r.status} ${await r.text()}`);
    return path;
  }

  async seedPlant(uid: string, p: { name: string; room?: string; withPhoto?: boolean; speciesId?: string }): Promise<{ id: string; photoPath?: string }> {
    const photoPath = p.withPhoto ? await this.upload(uid) : undefined;
    // A trigger on plants.photo_path adds the timeline row.
    const row = this.insert('plants', { user_id: uid, name: p.name, room: p.room, species_id: p.speciesId, photo_path: photoPath });
    return { id: row.id, photoPath };
  }

  /** `timeline: false` uploads the object only (no plant_photos row), like a photo referenced just by a scan. */
  async seedPhoto(uid: string, plantId: string, takenAt?: string, o: { timeline?: boolean } = {}): Promise<string> {
    const path = await this.upload(uid);
    if (o.timeline === false) return path;
    this.insert('plant_photos', { user_id: uid, plant_id: plantId, path, taken_at: takenAt });
    return path;
  }

  async seedDevice(uid: string, plantId: string, f: DeviceRow): Promise<{ id: string }> {
    return this.insert('devices', { secret_hash: randomBytes(32).toString('hex'), ...f, user_id: uid, plant_id: plantId });
  }

  async seedScans(uid: string, n: number, kind: 'identify' | 'health' = 'identify'): Promise<void> {
    const rows = Array.from({ length: n }, () => ({ user_id: uid, kind, status: 'ok' }));
    const r = await this.rest('/rest/v1/scans', { method: 'POST', headers: json, body: JSON.stringify(rows) });
    if (!r.ok) throw new Error(`seedScans: ${r.status} ${await r.text()}`);
  }

  async listObjects(uid: string): Promise<string[]> {
    const r = await this.rest('/storage/v1/object/list/plant-photos', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ prefix: uid, limit: 1000 }),
    });
    return ((await r.json()) as { name: string }[]).map((o) => `${uid}/${o.name}`);
  }
}

export const test = base.extend<{ user: TestUser }, { admin: Admin }>({
  admin: [
    async ({}, use) => {
      const admin = new Admin();
      await use(admin);
      await admin.deleteMade();
    },
    { scope: 'worker' },
  ],
  user: async ({ admin }, use) => {
    const u = await admin.createUser();
    try {
      await use(u);
    } finally {
      await admin.deleteUser(u);
    }
  },
});

export async function signIn(page: Page, u: TestUser): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Email').fill(u.email);
  await page.getByLabel('Password').fill(u.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Plants', { exact: true }).first()).toBeVisible();
}

// Earlier stack screens stay mounted (hidden), so click the visible one.
export const clickVisible = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).filter({ visible: true }).click();

export async function startSim(o: { code: string; name: string; scenario?: string; from?: '1d' | '6h'; speed?: number }): Promise<{ stop(): Promise<void>; exited: Promise<number | null> }> {
  const args = [SIM, '--claim', o.code, '--name', o.name, '--url', process.env.SUPABASE_URL!];
  if (o.scenario) args.push('--scenario', o.scenario);
  if (o.from) args.push('--from', o.from);
  if (o.speed) args.push('--speed', String(o.speed));
  const child = spawn('node', args, { stdio: 'ignore' });
  const exited = new Promise<number | null>((resolve) => child.once('exit', resolve));
  return {
    exited,
    async stop() {
      child.kill();
      await exited; // the sim may be mid-save: remove its file only after it is gone
      rmSync(join(SIM_DEVICES, `${o.name}.json`), { force: true });
    },
  };
}

export async function mailpitLink(email: string): Promise<string> {
  const mp = 'http://127.0.0.1:54324/api/v1';
  let link = '';
  await expect
    .poll(
      async () => {
        const { messages } = await (await fetch(`${mp}/search?query=${encodeURIComponent(`to:"${email}"`)}`)).json();
        if (!messages?.length) return '';
        const { Text } = await (await fetch(`${mp}/message/${messages[0].ID}`)).json();
        link = /https?:\/\/\S+\/auth\/v1\/verify\S*/.exec(Text)?.[0] ?? '';
        return link;
      },
      { timeout: 10_000 },
    )
    .not.toBe('');
  return link;
}
