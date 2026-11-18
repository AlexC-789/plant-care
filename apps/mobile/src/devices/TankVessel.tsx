import { Platform } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { useTheme } from '@/theme';

/** The tank as a vessel: body in waterFill, solid line at the water level. Decorative: the text row carries the meaning. */
export function TankVessel({ ml, fullMl, width = 28 }: { ml: number | null; fullMl: number; width?: number }) {
  const { colors } = useTheme();
  const y = 4 + 32 * (1 - Math.min(Math.max((ml ?? 0) / fullMl, 0), 1));
  return (
    <Svg width={width} height={(width * 40) / 28} viewBox="0 0 28 40"
      {...(Platform.OS === 'web' ? {} : { accessible: false })}
    >
      {ml === null ? null : <Rect x={2} y={y} width={24} height={36 - y + 4} rx={3} fill={colors.waterFill} />}
      <Path d="M2 4 V36 Q2 38 4 38 H24 Q26 38 26 36 V4" fill="none" stroke={colors.secondaryLabel} strokeWidth={1.5} />
      {ml === null ? null : <Path d={`M2 ${y} H26`} stroke={colors.water} strokeWidth={2} />}
    </Svg>
  );
}
