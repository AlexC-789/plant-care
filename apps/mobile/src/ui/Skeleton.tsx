import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, StyleSheet, View, type DimensionValue } from 'react-native';

import { space, typography, useTheme, type TextStyleName } from '@/theme';

import { useShimmer } from './ShimmerProvider';

const SKELETON_DELAY_MS = 300;
const BAND_WIDTH = 120;

/** False for the first `delayMs`, so fast loads never flash a placeholder. */
export function useDelayedVisible(delayMs = SKELETON_DELAY_MS): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);
  return visible;
}

/**
 * Wrap every loading placeholder in this: it appears after 300 ms and is announced once
 * to screen readers as "Loading" (the blocks inside are not read individually).
 */
export function LoadingGroup({ children }: { children: ReactNode }) {
  const visible = useDelayedVisible();
  if (!visible) return null;
  return (
    <View accessible accessibilityLabel="Loading">
      {children}
    </View>
  );
}

type SkeletonProps = { width?: DimensionValue; height: number; radius?: number; testID?: string };

/** A placeholder block in the shape of what's coming, with the shared shimmer sweep. */
export function Skeleton({ width = '100%', height, radius = 6, testID }: SkeletonProps) {
  const { colors } = useTheme();
  const progress = useShimmer();
  const [measured, setMeasured] = useState(0);

  const translateX = progress?.interpolate({
    inputRange: [0, 1],
    outputRange: [-BAND_WIDTH, measured + BAND_WIDTH],
  });

  return (
    <View
      testID={testID}
      onLayout={(e) => setMeasured(e.nativeEvent.layout.width)}
      style={[styles.block, { width, height, borderRadius: radius, backgroundColor: colors.skeleton }]}>
      {progress ? (
        <Animated.View testID="shimmer-band" style={[styles.band, { transform: [{ translateX }] }]}>
          <LinearGradient
            colors={[colors.skeleton, colors.skeletonHighlight, colors.skeleton]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

/** A text line placeholder: takes the line height of `variant`, with a slimmer bar inside. */
export function SkeletonText({
  variant = 'body',
  width = '60%',
  testID,
}: {
  variant?: TextStyleName;
  width?: DimensionValue;
  testID?: string;
}) {
  const lineHeight = typography[variant].lineHeight ?? 22;
  return (
    <View testID={testID} style={{ height: lineHeight, width, justifyContent: 'center' }}>
      <Skeleton height={Math.round(lineHeight * 0.6)} />
    </View>
  );
}

/** Placeholder for an InsetGroup row: a label line and, optionally, a value line. */
export function SkeletonRow({ withValue = false }: { withValue?: boolean }) {
  return (
    <View style={styles.row}>
      <SkeletonText width="40%" />
      {withValue ? <SkeletonText width="25%" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { overflow: 'hidden' },
  band: { position: 'absolute', top: 0, bottom: 0, width: BAND_WIDTH },
  row: {
    minHeight: space.touch,
    paddingHorizontal: space.l,
    paddingVertical: space.m,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
