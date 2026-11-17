import { useColorScheme, useWindowDimensions } from 'react-native';

import { colors, type ColorScheme, type Palette } from './colors';

export { colors, type ColorScheme, type ColorToken, type Palette } from './colors';
export { contrastRatio } from './contrast';
export { radius, space } from './spacing';
export { serifFamily, typography, type TextStyleName } from './typography';

/** Colours for the phone's current light/dark setting. */
export function useTheme(): { scheme: ColorScheme; colors: Palette } {
  const scheme: ColorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { scheme, colors: colors[scheme] };
}

/** True above the largest standard text size (iOS "accessibility sizes"). */
export function useIsAccessibilitySize(): boolean {
  return useWindowDimensions().fontScale > 1.4;
}
export { useReduceMotion } from './useReduceMotion';
