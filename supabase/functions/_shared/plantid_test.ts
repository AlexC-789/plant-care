import { assert } from '@std/assert';
import { PlantIdClient } from './plantid.ts';

const run = async (baseUrl?: string) => {
  let url = '';
  const fetch = ((u: string) => {
    url = String(u);
    return Promise.resolve(new Response('{}'));
  }) as typeof globalThis.fetch;
  await new PlantIdClient({ apiKey: 'k', fetch, baseUrl }).identify(['x']);
  return url;
};

Deno.test('PlantIdClient uses baseUrl when given', async () => {
  assert((await run('http://fake:8787')).startsWith('http://fake:8787/identification'));
});

Deno.test('PlantIdClient defaults to the real Plant.id base', async () => {
  assert((await run()).startsWith('https://plant.id/api/v3/'));
});
