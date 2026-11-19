import { useEffect, useState } from 'react';
import { Animated, View } from 'react-native';

import { motion, radius, space, useReduceMotion, useTheme } from '@/theme';

/** Segmented "Step n of total" bar, ink on the water track; the current segment fills from the left. */
export function StepProgress({ step, total = 4 }: { step: 1 | 2 | 3 | 4; total?: number }) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const [grow] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduceMotion) {
      grow.setValue(1);
      return;
    }
    grow.setValue(0);
    const anim = Animated.timing(grow, {
      toValue: 1,
      duration: motion.duration.progress,
      easing: motion.easeOut,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [step, reduceMotion, grow]);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${step} of ${total}`}
      style={{ flexDirection: 'row', gap: space.s }}
    >
      {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
        <View
          key={n}
          testID={`segment-${n}`}
          accessibilityState={{ checked: n <= step }}
          style={{
            flex: 1,
            height: 4,
            borderRadius: radius.capsule,
            overflow: 'hidden',
            backgroundColor: n < step ? colors.label : colors.waterFill,
          }}
        >
          {n === step && (
            <Animated.View
              testID={`fill-${n}`}
              style={{
                flex: 1,
                backgroundColor: colors.label,
                ...(reduceMotion ? {} : { transform: [{ scaleX: grow }] }),
                transformOrigin: 'left',
              }}
            />
          )}
        </View>
      ))}
    </View>
  );
}
