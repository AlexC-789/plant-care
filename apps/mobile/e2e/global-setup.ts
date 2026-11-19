import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Playwright compiles this file to CJS, so a plain import() of the .mjs would become require().
const importEsm = new Function('p', 'return import(p)') as (p: string) => Promise<typeof import('./fake-plantid.mjs')>;

export default async function globalSetup() {
  const { startFakePlantId, FAKE_PLANTID_PORT } = await importEsm(pathToFileURL(join(__dirname, 'fake-plantid.mjs')).href);
  // The Edge Runtime must call the fake, never the real Plant.id.
  const env = readFileSync(join(__dirname, '../../../supabase/functions/.env'), 'utf8');
  if (!new RegExp(`^PLANT_ID_BASE_URL=.*:${FAKE_PLANTID_PORT}(/|\\s|$)`, 'm').test(env)) {
    throw new Error(`supabase/functions/.env must set PLANT_ID_BASE_URL to the fake on port ${FAKE_PLANTID_PORT}; refusing to run e2e against Plant.id.`);
  }
  const fake = await startFakePlantId();
  return () => fake.close();
}
