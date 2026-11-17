import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** The system "Reduce Motion" setting, kept up to date. False until known. */
export function useReduceMotion(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setEnabled(value);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setEnabled);
    return () => {
      active = false;
      sub.remove();
    };
  }, []);
  return enabled;
}
