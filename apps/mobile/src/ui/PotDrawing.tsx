import { Platform } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/theme';

/** Stroke data, shared with the launch animation (which draws `body`, then `leaves`). */
export const POT_PATHS = {
  body: [
    // saucer with the capped fill hole on the front right
    'M22 112 H138 A8 8 0 0 1 138 128 H22 A8 8 0 0 1 22 112 Z',
    'M122 120 h 10',
    // pot with rim
    'M36 62 L 44 112 H 116 L 124 62',
    'M32 54 L 32 62 H 128 L 128 54',
    'M30 54 H 130',
    // stake: plant-label head above the soil
    'M112 50 V 54',
    'M108 30 H116 Q118 30 118 32 V48 Q118 50 116 50 H108 Q106 50 106 48 V32 Q106 30 108 30 Z',
  ],
  leaves: [
    'M70 52 C 62 40, 50 30, 40 26 C 46 38, 56 48, 70 52',
    'M74 52 C 72 36, 76 20, 84 10 C 88 24, 84 40, 74 52',
    'M78 52 C 84 46, 92 42, 100 42 C 95 49, 87 54, 78 52',
  ],
} as const;

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
      {[...POT_PATHS.body, ...POT_PATHS.leaves].map((d) => (
        <Path key={d} d={d} />
      ))}
    </Svg>
  );
}
