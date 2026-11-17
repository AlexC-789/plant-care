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
  isHealthyProbability: number;
  issues: { name: string; probability: number }[];
}
export interface NameHit {
  commonName: string;
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
      isHealthyProbability: Number(result?.is_healthy?.probability ?? 0),
      issues: issues
        .filter((i) => typeof i?.name === 'string')
        .map((i) => ({ name: i.name, probability: Number(i.probability) })),
    };
  }

  /** name_search only returns matches (no scientific name for common-name hits), so those are resolved via the KB entity. */
  async nameSearch(q: string): Promise<NameHit[]> {
    const body = await this.call(`/kb/plants/name_search?q=${encodeURIComponent(q)}&limit=10`);
    const entities: Json[] = (body?.entities ?? []).filter((e: Json) => typeof e?.matched_in === 'string');
    const hits = await Promise.all(entities.slice(0, 10).map(async (e): Promise<NameHit | null> => {
      if (e.matched_in_type === 'entity_name') return { commonName: '', scientificName: e.matched_in };
      if (typeof e.access_token !== 'string') return null;
      try {
        const name = (await this.call(`/kb/plants/${encodeURIComponent(e.access_token)}`))?.name;
        return typeof name === 'string' ? { commonName: e.matched_in, scientificName: name } : null;
      } catch {
        return null; // one unresolvable hit should not fail the whole search
      }
    }));
    return hits.filter((h): h is NameHit => h !== null);
  }
}
