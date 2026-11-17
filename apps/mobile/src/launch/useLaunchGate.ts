import { useCallback, useState } from 'react';

/** Module-level: the launch animation plays once per app run, not on every remount. */
let played = false;

export function resetLaunchForTests() {
  played = false;
}

/**
 * The launch overlay stays until its drawing has finished AND the saved session is known
 * (never a blank frame), then fades out into the first screen and unmounts.
 */
export function useLaunchGate(sessionLoading: boolean): {
  mounted: boolean;
  fadingOut: boolean;
  onAnimationDone: () => void;
  onExited: () => void;
} {
  const [shouldPlay] = useState(() => !played);
  const [animationDone, setAnimationDone] = useState(false);
  const [exited, setExited] = useState(false);

  const onAnimationDone = useCallback(() => {
    played = true;
    setAnimationDone(true);
  }, []);
  const onExited = useCallback(() => setExited(true), []);

  return {
    mounted: shouldPlay && !exited,
    fadingOut: animationDone && !sessionLoading,
    onAnimationDone,
    onExited,
  };
}
