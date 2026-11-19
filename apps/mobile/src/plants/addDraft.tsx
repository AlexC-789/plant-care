import { createContext, useContext, useState, type ReactNode } from 'react';

import type { IdentifyResult, Light } from './api';

// `scientific` is for names-only hits that have no common name.
export type Species = { id: string; name: string; scientific?: string } | { custom: string };
/** What Capture hands on (DESIGN_SYSTEM §8): today one re-encoded JPEG, already uploaded. */
export type Capture = { localUri: string; path: string };
export type Draft = {
  capture?: Capture;
  scanId?: string;
  suggestions?: IdentifyResult['suggestions'];
  species?: Species;
  /** What the user typed; undefined until they touch the field, so it follows the type. */
  nickname?: string;
  room: string;
  light: Light;
  plantId?: string;
};

const empty: Draft = { room: '', light: 'medium' };
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

/** What the name field shows: the typed text, else the type's name. */
export const nameField = (d: Draft) => d.nickname ?? typeName(d) ?? '';

/** What the plant is saved as; undefined when the name is empty. */
export const plantName = (d: Draft) => nameField(d).trim() || undefined;
