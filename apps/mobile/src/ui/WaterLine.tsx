import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { motion, useReduceMotion, useTheme } from '@/theme';

import { Text } from './Text';

const LOW_MIN = 0.05; // a low tank still shows a sliver of red, never nothing

/**
 * The water line (DESIGN_SYSTEM §1, §3): water on the track, red when low, dashed with no reading.
 * Decorative: always pair it with words that say the same thing.
 */
export function WaterLine({
  level,
  low,
  height = 4,
  testID = 'water-line',
}: {
  level: number | null;
  low: boolean;
  height?: number;
  testID?: string;
}) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const target = Math.min(Math.max(low ? Math.max(level ?? 0, LOW_MIN) : (level ?? 0), 0), 1);
  const [scale] = useState(() => new Animated.Value(target));

  useEffect(() => {
    if (reduceMotion) return scale.setValue(target);
    const anim = Animated.timing(scale, { toValue: target, duration: 600, easing: motion.easeOut, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [target, reduceMotion, scale]);

  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ height, borderRadius: height / 2, overflow: 'hidden', backgroundColor: level === null && !low ? undefined : colors.waterFill }}>
      {level === null && !low ? (
        <Svg testID="water-none" width="100%" height={height}>
          <Line x1="0" y1={height / 2} x2="100%" y2={height / 2} stroke={colors.waterFill} strokeWidth={height} strokeDasharray="6 4" />
        </Svg>
      ) : (
        <Animated.View
          testID="water-fill"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: low ? colors.statusNow : colors.water, transform: [{ scaleX: scale }], transformOrigin: 'left' },
          ]}
        />
      )}
    </View>
  );
}

/** The tank in words, to the nearest 50 ml: what every water line is paired with. */
export const tankWords = (ml: number | null, low: boolean) =>
  low ? 'Nearly empty' : ml === null ? 'No current reading' : `About ${Math.round(ml / 50) * 50} ml`;

/** The plant page tank bar: always with "About {n} ml" and "of {full} ml". */
export function TankBar({ ml, fullMl, low }: { ml: number | null; fullMl: number; low: boolean }) {
  const amount = tankWords(ml, low);
  const of = `of ${fullMl} ml`;
  return (
    <View accessible accessibilityLabel={`Tank, ${amount.toLowerCase()} ${of}`} style={styles.tank}>
      <WaterLine level={ml === null ? null : ml / fullMl} low={low} height={10} testID="tank-bar" />
      <View style={styles.labels}>
        <Text variant="footnote" color={low ? 'statusNow' : 'label'} style={styles.figures}>
          {amount}
        </Text>
        <Text variant="footnote" color="secondaryLabel" style={styles.figures}>
          {of}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tank: { gap: 6 },
  labels: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 },
  figures: { fontVariant: ['tabular-nums'] },
});
