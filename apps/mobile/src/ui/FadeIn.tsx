import { useEffect, useState, type ReactNode } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';

import { useReduceMotion } from '@/theme';

export const FADE_IN_MS = 150;

/** Cross-fades content in where a skeleton was. Instant with Reduce Motion. */
export function FadeIn({
  children,
  style,
  testID,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const reduceMotion = useReduceMotion();
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }
    // JS driver: a 150 ms one-off fade; keeps the value observable (and testable).
    const fade = Animated.timing(opacity, { toValue: 1, duration: FADE_IN_MS, useNativeDriver: false });
    fade.start();
    return () => fade.stop();
  }, [reduceMotion, opacity]);

  return (
    <Animated.View testID={testID} style={[style, { opacity }]}>
      {children}
    </Animated.View>
  );
}
