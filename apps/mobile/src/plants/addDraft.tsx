import { createContext, useContext, useState, type ReactNode } from 'react';

import type { IdentifyResult } from './api';
import type { Photo } from './CaptureCards';

// `scientific` is for names-only hits that have no common name.
export type Species = { id: string; name: string; scientific?: string } | { custom: string };
export type Draft = {
  photos: Photo[];
  scanId?: string;
  suggestions?: IdentifyResult['suggestions'];
  species?: Species;
  /** Only what the user typed; the saved name comes from `plantName`. */
  nickname: string;
  room: string;
  plantId?: string;
  healthStarted?: boolean;
};

const empty: Draft = { photos: [], nickname: '', room: '' };
const Ctx = createContext<{ draft: Draft; set: (patch: Partial<Draft>) => void } | null>(null);

/** In-memory state of the add flow (a killed app loses it; uploaded orphans are accepted). */
export function AddDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState(empty);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  return <Ctx.Provider value={{ draft, set }}>{children}</Ctx.Provider>;
}

export function useAddDraft() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAddDraft outside AddDraftProvider');
  return v;
}

/** The chosen type's display name (common name, else scientific, else the custom text). */
export const typeName = ({ species }: Draft) =>
  !species ? undefined : 'custom' in species ? species.custom : species.name || species.scientific || undefined;

/** What the plant is saved as: nickname, else the type's name. Undefined when step 3 must ask. */
export const plantName = (d: Draft) => d.nickname.trim() || typeName(d);
