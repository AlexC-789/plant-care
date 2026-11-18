import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Platform, View } from 'react-native';

import { motion, space, useReduceMotion, useTheme } from '@/theme';
import { Icon } from './Icon';
import { Text } from './Text';

/** Fades in (and scales from 0.95, unless Reduce Motion) after `delay` ms. */
function Enter({ delay, testID, children }: { delay: number; testID?: string; children: ReactNode }) {
  const reduceMotion = useReduceMotion();
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduceMotion) {
      t.setValue(1);
      return;
    }
    const anim = Animated.timing(t, {
      toValue: 1,
      duration: motion.duration.success,
      delay,
      easing: motion.easeOut,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [reduceMotion, delay, t]);
  return (
    <Animated.View
      testID={testID}
      style={{
        opacity: t,
        ...(reduceMotion ? {} : { transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }] }),
      }}
    >
      {children}
    </Animated.View>
  );
}

/** The success moment: a check in a good-status circle, the title, then any content. */
export function StepDone({ title, children }: { title: string; children?: ReactNode }) {
  const { colors } = useTheme();
  // iOS ignores accessibilityLiveRegion, so announce explicitly (once per mount); Android speaks the live region.
  useEffect(() => {
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(title);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View accessibilityLiveRegion="polite" style={{ alignItems: 'center', gap: space.l }}>
      <Enter delay={0} testID="done-icon">
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.statusFine,
          }}
        >
          <Icon name="checkmark" size={32} color="onTint" />
        </View>
      </Enter>
      <Enter delay={motion.stagger}>
        <Text variant="title" style={{ textAlign: 'center' }}>
          {title}
        </Text>
      </Enter>
      {children ? <Enter delay={motion.stagger * 2}>{children}</Enter> : null}
    </View>
  );
}
