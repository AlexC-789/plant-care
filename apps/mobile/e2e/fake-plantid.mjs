// Fake Plant.id for e2e: Edge Functions point PLANT_ID_BASE_URL here. Zero deps.
// Run standalone: node apps/mobile/e2e/fake-plantid.mjs
import http from 'node:http';
import { fileURLToPath } from 'node:url';

export const FAKE_PLANTID_PORT = 8787;
const DEFAULTS = { identify: 'very_likely', health: 'healthy' };

const sug = (name, probability, common) => ({
  name,
  probability,
  details: {
    common_names: [common],
    description: `${name} is a popular houseplant.`,
    watering: { min: 2, max: 2 },
    best_light_condition: 'Bright indirect light',
  },
});
const identification = (isPlant, suggestions) => ({
  result: { is_plant: { probability: isPlant }, classification: { suggestions } },
});
const IDENTIFY = {
  very_likely: identification(0.99, [
    sug('Calathea makoyana', 0.92, 'Peacock plant'),
    sug('Calathea ornata', 0.04, 'Pinstripe plant'), // below the 0.05 floor, must be filtered
    sug('Maranta leuconeura', 0.3, 'Prayer plant'),
  ]),
  low: identification(0.99, [sug('Calathea makoyana', 0.3, 'Peacock plant')]),
  not_plant: identification(0.1, []),
};
const health = (healthy, issues) => ({
  result: { is_plant: { probability: 0.99 }, is_healthy: { probability: healthy }, disease: { suggestions: issues } },
});
const HEALTH = { healthy: health(0.92, []), issue: health(0.2, [{ name: 'Fungi', probability: 0.7 }]) };
const NAMES = {
  entities: [{ matched_in: 'Peacock plant', matched_in_type: 'common_name', entity_name: 'Calathea makoyana' }],
};

export function startFakePlantId(port = FAKE_PLANTID_PORT) {
  let scenario = { ...DEFAULTS };
  let calls = 0;
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const { pathname } = new URL(req.url, 'http://fake');
    const send = (status, body) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (pathname === '/__calls') return send(200, { calls });
    if (pathname === '/__reset') {
      scenario = { ...DEFAULTS };
      calls = 0;
      return send(200, {});
    }
    if (pathname === '/__scenario') {
      try {
        scenario = { ...scenario, ...JSON.parse(Buffer.concat(chunks).toString() || '{}') };
      } catch {
        return send(400, {});
      }
      return send(200, scenario);
    }
    calls++;
    if (pathname.endsWith('/identification')) {
      return scenario.identify === 'error' ? send(500, {}) : send(200, IDENTIFY[scenario.identify]);
    }
    if (pathname.endsWith('/health_assessment')) {
      return scenario.health === 'error' ? send(500, {}) : send(200, HEALTH[scenario.health]);
    }
    if (pathname.endsWith('/kb/plants/name_search')) return send(200, NAMES);
    send(404, {});
  });
  return new Promise((resolve) =>
    server.listen(port, '127.0.0.1', () =>
      resolve({
        url: `http://127.0.0.1:${server.address().port}`,
        setScenario: (s) => void (scenario = { ...scenario, ...s }),
        calls: () => calls,
        close: () => new Promise((r) => (server.closeAllConnections(), server.close(r))),
      }),
    ),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const fake = await startFakePlantId();
  console.log(`fake Plant.id on ${fake.url}`);
}
