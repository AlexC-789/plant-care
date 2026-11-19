import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { FullConfig } from '@playwright/test';

// Playwright compiles this file to CJS, so a plain import() of the .mjs would become require().
const importEsm = new Function('p', 'return import(p)') as (p: string) => Promise<typeof import('./fake-plantid.mjs')>;

export default async function globalSetup(config: FullConfig) {
  const { startFakePlantId, FAKE_PLANTID_PORT } = await importEsm(pathToFileURL(join(__dirname, 'fake-plantid.mjs')).href);
  // The RUNNING Edge Runtime must call the fake, never the real Plant.id (the CLI reads functions/.env only at start).
  let url = '';
  try {
    url = execFileSync('docker', ['exec', 'supabase_edge_runtime_plant-care', 'printenv', 'PLANT_ID_BASE_URL'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    // container missing or variable unset: reported below
  }
  if (!new RegExp(`^http://[^/]+:${FAKE_PLANTID_PORT}(/|$)`).test(url)) {
    throw new Error(`The running Edge Runtime must have PLANT_ID_BASE_URL set to the fake on port ${FAKE_PLANTID_PORT} (got "${url}"); set it in supabase/functions/.env and restart Supabase. Refusing to run e2e against Plant.id.`);
  }
  // The dev server answers index.html before bundling (web.output "single"): fetch the bundle now so no test pays for it.
  if (process.env.E2E_SPEED !== '1') {
    const base = config.projects[0].use.baseURL!;
    const html = await (await fetch(base, { signal: AbortSignal.timeout(180_000) })).text();
    for (const m of html.matchAll(/<script[^>]+src="([^"]+)"/g)) await fetch(new URL(m[1], base), { signal: AbortSignal.timeout(180_000) }).then((r) => r.arrayBuffer());
  }
  const fake = await startFakePlantId();
  return () => fake.close();
}
