import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startFakePlantId } from './fake-plantid.mjs';

const post = (fake, path) => fetch(`${fake.url}${path}`, { method: 'POST', body: '{"images":["x"]}' });

test('fake Plant.id serves scenarios and counts API calls', async () => {
  const fake = await startFakePlantId(0);
  try {
    const ok = await (await post(fake, '/identification?details=common_names')).json();
    assert.equal(ok.result.classification.suggestions[0].name, 'Calathea makoyana');
    assert.equal(fake.calls(), 1);

    fake.setScenario({ identify: 'not_plant' });
    const np = await (await post(fake, '/identification')).json();
    assert.ok(np.result.is_plant.probability < 0.5);

    fake.setScenario({ identify: 'error' });
    assert.equal((await post(fake, '/identification')).status, 500);

    const h = await (await post(fake, '/health_assessment')).json();
    assert.ok(h.result.is_healthy.probability > 0.5);

    fake.setScenario({ health: 'issue' });
    const hi = await (await post(fake, '/health_assessment')).json();
    assert.equal(hi.result.disease.suggestions[0].name, 'Fungi');

    const names = await (await fetch(`${fake.url}/kb/plants/name_search?q=pea`)).json();
    assert.equal(names.entities[0].entity_name, 'Calathea makoyana');

    // control routes are not counted; /__calls reports the count
    assert.equal(fake.calls(), 6);
    await fetch(`${fake.url}/__scenario`, { method: 'POST', body: '{"identify":"low"}' });
    const low = await (await post(fake, '/identification')).json();
    assert.equal(low.result.classification.suggestions[0].probability, 0.3);
    assert.deepEqual(await (await fetch(`${fake.url}/__calls`)).json(), { calls: 7 });

    await fetch(`${fake.url}/__reset`, { method: 'POST' });
    assert.equal(fake.calls(), 0);
    assert.equal((await post(fake, '/identification')).status, 200);
  } finally {
    await fake.close();
  }
});
