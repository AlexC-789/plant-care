import type { HealthResult } from './plantid.ts';

export const HEALTHY_NOTE = 'It looks healthy in this photo.';
export const UNSURE_NOTE = "Couldn't tell from this photo. Try one with the leaves in view.";

export interface HealthNote {
  healthy: boolean | null;
  note: string;
  advice: string | null;
}

// Plant.id health class names (lower case) -> plain words. Anything else is "unsure": we never show a provider name.
const NOTES = new Map<string, Omit<HealthNote, 'healthy'>>(Object.entries({
  'water excess or uneven watering': { note: 'Some leaves look yellow. Often too much water.', advice: 'Let the top few centimetres of soil dry before watering again.' },
  'root rot': { note: 'Some leaves look yellow. Often too much water.', advice: 'Let the top few centimetres of soil dry before watering again.' },
  'water deficiency': { note: 'The leaves look dry or droopy. Often too little water.', advice: 'Water thoroughly, then water when the top few centimetres of soil are dry.' },
  'nutrient deficiency': { note: 'The leaves look pale. It may need feeding.', advice: 'Feed with a diluted houseplant fertiliser during the growing season.' },
  'light excess': { note: 'Some leaves look scorched. Often too much direct sun.', advice: 'Move it out of strong direct sun.' },
  'sunburn': { note: 'Some leaves look scorched. Often too much direct sun.', advice: 'Move it out of strong direct sun.' },
  'light deficiency': { note: 'It looks stretched or pale. Often too little light.', advice: 'Move it closer to a bright window.' },
  'senescence': { note: 'Some older leaves are fading. This is often normal ageing.', advice: 'Remove the old leaves once they are fully yellow.' },
  'mechanical damage': { note: 'Some leaves look torn or bruised.', advice: 'Keep it where it will not be knocked, and trim badly damaged leaves.' },
  'fungi': { note: 'There are spots on the leaves. Often a fungus.', advice: 'Remove the spotted leaves and keep water off the leaves.' },
  'leaf spot': { note: 'There are spots on the leaves. Often a fungus.', advice: 'Remove the spotted leaves and keep water off the leaves.' },
  'powdery mildew': { note: 'There is a white powder on the leaves. Often mildew.', advice: 'Remove the worst leaves and give it more air around it.' },
  'downy mildew': { note: 'There are pale patches on the leaves. Often mildew.', advice: 'Remove the worst leaves, water the soil only, and give it more air.' },
  'bacteria': { note: 'There are dark wet-looking spots. Often bacteria.', advice: 'Cut off the affected leaves with clean scissors and keep the leaves dry.' },
  'insecta': { note: 'There may be small insects on it.', advice: 'Wipe the leaves with soapy water and check under them weekly.' },
  'pests': { note: 'There may be small insects on it.', advice: 'Wipe the leaves with soapy water and check under them weekly.' },
  'aphids': { note: 'There may be small insects on it.', advice: 'Wipe the leaves with soapy water and check under them weekly.' },
  'mealybugs': { note: 'There may be small insects on it.', advice: 'Wipe the leaves with soapy water and check under them weekly.' },
  'spider mites': { note: 'There may be tiny mites on it. Look for fine webs.', advice: 'Rinse the leaves and keep the air around it less dry.' },
}));

/** Healthy probability >= 0.8 -> healthy; else a mapped top issue >= 0.5; otherwise unsure. */
export function healthNote(r: HealthResult): HealthNote {
  if (r.isHealthyProbability >= 0.8) return { healthy: true, note: HEALTHY_NOTE, advice: null };
  const top = r.issues[0];
  const mapped = top && top.probability >= 0.5 ? NOTES.get(top.name.toLowerCase()) : undefined;
  return mapped ? { healthy: false, ...mapped } : { healthy: null, note: UNSURE_NOTE, advice: null };
}
