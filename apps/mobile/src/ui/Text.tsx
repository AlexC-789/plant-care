import { Text as RNText, type TextProps } from 'react-native';

import { typography, useTheme, type ColorToken, type TextStyleName } from '@/theme';

type Props = TextProps & { variant?: TextStyleName; color?: ColorToken };

/** Text in one of the design's styles. Scales with the system text size, never capped. */
export function Text({ variant = 'body', color = 'label', style, ...rest }: Props) {
  const { colors } = useTheme();
  return <RNText {...rest} style={[typography[variant], { color: colors[color] }, style]} />;
}
