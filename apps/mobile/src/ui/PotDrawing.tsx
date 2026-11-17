import { Platform } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { useTheme } from '@/theme';

/**
 * Hairline drawing of the real product: the saucer (tank) under a pot, with the
 * plant-label-shaped sensor stake in the soil. The app's only illustration.
 */
export function PotDrawing({ width = 160 }: { width?: number }) {
  const { colors } = useTheme();
  const stroke = colors.secondaryLabel;
  return (
    <Svg
      width={width}
      height={(width * 140) / 160}
      viewBox="0 0 160 140"
      {...(Platform.OS === 'web' ? { role: 'img' } : { accessible: true, accessibilityRole: 'image' as const })}
      accessibilityLabel="Drawing of a pot standing on the watering saucer, with the sensor stake in the soil"
      fill="none"
      stroke={stroke}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round">
      {/* leaves */}
      <Path d="M70 52 C 62 40, 50 30, 40 26 C 46 38, 56 48, 70 52" />
      <Path d="M74 52 C 72 36, 76 20, 84 10 C 88 24, 84 40, 74 52" />
      <Path d="M78 52 C 84 46, 92 42, 100 42 C 95 49, 87 54, 78 52" />
      {/* stake: plant-label head above the soil */}
      <Rect x={106} y={30} width={12} height={20} rx={2} />
      <Path d="M112 50 V 54" />
      {/* pot with rim */}
      <Path d="M30 54 H 130" />
      <Path d="M32 54 L 32 62 H 128 L 128 54" />
      <Path d="M36 62 L 44 112 H 116 L 124 62" />
      {/* saucer with the capped fill hole on the front right */}
      <Rect x={14} y={112} width={132} height={16} rx={8} />
      <Path d="M122 120 h 10" />
    </Svg>
  );
}
