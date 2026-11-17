import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing } from 'react-native';

import { useReduceMotion } from '@/theme';

export const SHIMMER_PERIOD_MS = 1600;

/** null when Reduce Motion is on: skeletons stay static. */
const ShimmerContext = createContext<Animated.Value | null>(null);

/**
 * One shimmer clock for the whole app, so every skeleton on screen sweeps in step and a
 * list reads as one surface. Runs on the native driver (UI thread). The only looping
 * motion the design allows.
 */
export function ShimmerProvider({ children }: { children: ReactNode }) {
  const reduceMotion = useReduceMotion();
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduceMotion) return;
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
  }, [reduceMotion, progress]);

  return (
    <ShimmerContext.Provider value={reduceMotion ? null : progress}>{children}</ShimmerContext.Provider>
  );
}

export function useShimmer(): Animated.Value | null {
  return useContext(ShimmerContext);
}
