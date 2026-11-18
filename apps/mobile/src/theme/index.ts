import { useWindowDimensions } from 'react-native';

import { useAppearance } from './appearance';
import { colors, type ColorScheme, type Palette } from './colors';

export {
  loadStoredAppearance,
  resetAppearanceForTests,
  useAppearance,
  useAppearanceLoaded,
  type Appearance,
} from './appearance';
export { colors, type ColorScheme, type ColorToken, type Palette } from './colors';
export { contrastRatio } from './contrast';
export { motion } from './motion';
export { radius, space } from './spacing';
export { serifFamily, typography, type TextStyleName } from './typography';

/** Colours for the user's Appearance choice (light by default; see appearance.ts). */
export function useTheme(): { scheme: ColorScheme; colors: Palette } {
  const scheme: ColorScheme = useAppearance().appearance;
  return { scheme, colors: colors[scheme] };
}

/** True above the largest standard text size (iOS "accessibility sizes"). */
export function useIsAccessibilitySize(): boolean {
  return useWindowDimensions().fontScale > 1.4;
}
export { useReduceMotion } from './useReduceMotion';
