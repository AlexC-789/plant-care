const BASE = 'https://plant.id/api/v3';
const IDENTIFY_DETAILS = 'common_names,description,watering,best_light_condition';

export type Confidence = 'very_likely' | 'likely' | 'possibly';

export interface Suggestion {
  scientificName: string;
  commonNames: string[];
  probability: number;
  confidence: Confidence;
  // watering: Plant.id's 1 (dry) .. 3 (wet) scale
  details: { description?: string; watering?: { min: number; max: number }; bestLight?: string };
}
export interface IdentifyResult {
  isPlant: boolean;
  isPlantProbability: number;
  suggestions: Suggestion[];
}
export interface HealthResult {
  isPlantProbability: number;
  isHealthyProbability: number;
  /** Sorted by probability, highest first. */
  issues: { name: string; probability: number }[];
}
export interface NameHit {
  commonName: string; // '' when unknown
  scientificName: string;
}

/** Any network, timeout or non-2xx failure. The message never carries the key or provider text. */
export class ProviderError extends Error {
  constructor(message = 'Plant.id request failed') {
    super(message);
    this.name = 'ProviderError';
  }
}

export function confidenceWord(p: number): Confidence {
  return p >= 0.7 ? 'very_likely' : p >= 0.35 ? 'likely' : 'possibly';
}

// deno-lint-ignore no-explicit-any
type Json = any;

export class PlantIdClient {
  private apiKey: string;
  private fetch: typeof fetch;
  private timeoutMs: number;

  constructor(opts: { apiKey: string; fetch: typeof fetch; timeoutMs?: number }) {
    this.apiKey = opts.apiKey;
    this.fetch = opts.fetch;
    this.timeoutMs = opts.timeoutMs ?? 20_000;
  }

  private async call(path: string, init: RequestInit = {}): Promise<Json> {
    try {
      const res = await this.fetch(`${BASE}${path}`, {
        ...init,
        headers: { 'Api-Key': this.apiKey, 'content-type': 'application/json' },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) {
        await res.body?.cancel();
        throw new ProviderError(`Plant.id responded ${res.status}`);
      }
      return await res.json();
    } catch (e) {
      throw e instanceof ProviderError ? e : new ProviderError();
    }
  }

  private post(path: string, images: string[]) {
    return this.call(path, { method: 'POST', body: JSON.stringify({ images, similar_images: false }) });
  }

  async identify(images: string[]): Promise<IdentifyResult> {
    const result = (await this.post(`/identification?details=${IDENTIFY_DETAILS}`, images))?.result;
    const isPlantProbability = Number(result?.is_plant?.probability ?? 0);
    const isPlant = isPlantProbability >= 0.5;
    const raw: Json[] = isPlant ? result?.classification?.suggestions ?? [] : [];
    const suggestions = raw
      .filter((s) => typeof s?.name === 'string' && s.probability >= 0.05)
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 3)
      .map((s): Suggestion => {
        const d = s.details ?? {};
        const w = d.watering;
        // the client documents description as a string; accept the older { value } shape too
        const description = typeof d.description === 'string' ? d.description : d.description?.value;
        return {
          scientificName: s.name,
          commonNames: Array.isArray(d.common_names) ? d.common_names.filter((n: Json) => typeof n === 'string') : [],
          probability: s.probability,
          confidence: confidenceWord(s.probability),
          details: {
            ...(typeof description === 'string' && { description }),
            ...(typeof w?.min === 'number' && typeof w?.max === 'number' && { watering: { min: w.min, max: w.max } }),
            ...(typeof d.best_light_condition === 'string' && { bestLight: d.best_light_condition }),
          },
        };
      });
    return { isPlant, isPlantProbability, suggestions };
  }

  async health(images: string[]): Promise<HealthResult> {
    const result = (await this.post('/health_assessment', images))?.result;
    const issues: Json[] = result?.disease?.suggestions ?? [];
    return {
      isPlantProbability: Number(result?.is_plant?.probability ?? 0),
      isHealthyProbability: Number(result?.is_healthy?.probability ?? 0),
      issues: issues
        .filter((i) => typeof i?.name === 'string' && typeof i.probability === 'number' && Number.isFinite(i.probability))
        .sort((a, b) => b.probability - a.probability)
        .map((i) => ({ name: i.name, probability: i.probability })),
    };
  }

  // shortcut: name_search doesn't return scientific names for common-name matches without a paid detail call;
  // common-name-only hits are dropped unless entity_name is present — revisit with a real API response
  async nameSearch(q: string): Promise<NameHit[]> {
    const body = await this.call(`/kb/plants/name_search?q=${encodeURIComponent(q)}&limit=10`);
    const entities: Json[] = body?.entities ?? [];
    const hits = new Map<string, NameHit>();
    for (const e of entities) {
      if (typeof e?.matched_in !== 'string') continue;
      const hit: NameHit | null = typeof e.entity_name === 'string'
        ? { scientificName: e.entity_name, commonName: e.matched_in_type === 'common_name' ? e.matched_in : '' }
        : e.matched_in_type === 'entity_name'
        ? { scientificName: e.matched_in, commonName: '' }
        : null;
      if (hit && !hits.has(hit.scientificName)) hits.set(hit.scientificName, hit);
    }
    return [...hits.values()].slice(0, 10);
  }
}
