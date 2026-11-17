import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { Appearance as RNAppearance } from 'react-native';

/** Light by default, whatever the phone's setting; Dark is a choice in Settings. */
export type Appearance = 'light' | 'dark';

const STORAGE_KEY = 'plant-care.appearance';

type State = { appearance: Appearance; loaded: boolean };
let state: State = { appearance: 'light', loaded: false };
const listeners = new Set<() => void>();

function set(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Native keyboard, alerts and pickers follow the app's choice (not on web). */
function applyToPlatform(appearance: Appearance) {
  try {
    RNAppearance.setColorScheme?.(appearance);
  } catch {
    // Unsupported platform: the app's own colours still follow the choice.
  }
}

/** Read the saved choice (call once at start-up). Any failure leaves the default, light. */
export async function loadStoredAppearance(): Promise<void> {
  let stored: string | null = null;
  try {
    stored = await AsyncStorage.getItem(STORAGE_KEY);
  } catch {
    stored = null;
  }
  const appearance: Appearance = stored === 'dark' ? 'dark' : 'light';
  applyToPlatform(appearance);
  set({ appearance, loaded: true });
}

function setAppearance(appearance: Appearance) {
  applyToPlatform(appearance);
  set({ appearance });
  AsyncStorage.setItem(STORAGE_KEY, appearance).catch(() => {
    // Not saved: the choice still applies for this session.
  });
}

const getSnapshot = () => state;

export function useAppearance(): { appearance: Appearance; setAppearance: (a: Appearance) => void } {
  const { appearance } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { appearance, setAppearance };
}

/** True once the saved choice has been read, so the first frame uses the right colours. */
export function useAppearanceLoaded(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot).loaded;
}

export function resetAppearanceForTests(appearance: Appearance = 'light') {
  state = { appearance, loaded: false };
  listeners.forEach((listener) => listener());
}
