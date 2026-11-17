import { useCallback, useState } from 'react';

/** Module-level: the launch animation plays once per app run, not on every remount. */
let played = false;

export function resetLaunchForTests() {
  played = false;
}

/**
 * Show the launch animation until it has finished AND the saved session is known,
 * so it never adds waiting on top of loading and never leaves a blank frame.
 */
export function useLaunchGate(sessionLoading: boolean): {
  showLaunch: boolean;
  onAnimationDone: () => void;
} {
  const [shouldPlay] = useState(() => !played);
  const [animationDone, setAnimationDone] = useState(false);

  const onAnimationDone = useCallback(() => {
    played = true;
    setAnimationDone(true);
  }, []);

  return { showLaunch: shouldPlay && (!animationDone || sessionLoading), onAnimationDone };
}
