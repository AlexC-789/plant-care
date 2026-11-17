import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing } from 'react-native';

import { useReduceMotion } from '@/theme';

export const SHIMMER_PERIOD_MS = 1600;

type Shimmer = {
  /** null when Reduce Motion is on: skeletons stay static. */
  progress: Animated.Value | null;
  /** Skeletons register while mounted; the loop only runs while at least one is. */
  register: () => () => void;
};

const ShimmerContext = createContext<Shimmer>({ progress: null, register: () => () => {} });

/**
 * One shimmer clock for the whole app, so every skeleton on screen sweeps in step and a
 * list reads as one surface. Runs on the native driver, and only while a skeleton is on
 * screen. The only looping motion the design allows.
 */
export function ShimmerProvider({ children }: { children: ReactNode }) {
  const reduceMotion = useReduceMotion();
  const [progress] = useState(() => new Animated.Value(0));
  const [mounted, setMounted] = useState(0);

  const register = useCallback(() => {
    setMounted((n) => n + 1);
    return () => setMounted((n) => n - 1);
  }, []);

  const running = mounted > 0 && !reduceMotion;
  useEffect(() => {
    if (!running) return;
    progress.setValue(0);
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: SHIMMER_PERIOD_MS,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [running, progress]);

  return (
    <ShimmerContext.Provider value={{ progress: reduceMotion ? null : progress, register }}>
      {children}
    </ShimmerContext.Provider>
  );
}

export function useShimmer(): Animated.Value | null {
  return useContext(ShimmerContext).progress;
}

/** Keeps the shimmer loop running while the calling skeleton is mounted. */
export function useShimmerRegistration(): void {
  const { register } = useContext(ShimmerContext);
  useEffect(() => register(), [register]);
}
