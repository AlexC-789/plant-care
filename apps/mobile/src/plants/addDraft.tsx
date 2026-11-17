import { createContext, useContext, useState, type ReactNode } from 'react';

import type { IdentifyResult } from './api';
import type { Photo } from './CaptureCards';

export type Species = { id: string; name: string } | { custom: string };
export type Draft = {
  photos: Photo[];
  scanId?: string;
  suggestions?: IdentifyResult['suggestions'];
  species?: Species;
  name: string;
  room: string;
};

const empty: Draft = { photos: [], name: '', room: '' };
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
