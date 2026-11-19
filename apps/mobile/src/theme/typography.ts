import type { TextStyle } from 'react-native';

/**
 * Archivo, bundled as static fonts (SIL OFL, assets/fonts/OFL.txt). Each weight is its own family:
 * custom fonts ignore `fontWeight` on Android, so styles never set it.
 */
export const fonts = {
  regular: 'Archivo-Regular',
  italic: 'Archivo-Italic',
  semiBold: 'Archivo-SemiBold',
  condensed: 'ArchivoCondensed-ExtraBold',
} as const;

/** Loaded by the root layout before the first screen (expo-font). */
export const fontFiles = {
  [fonts.regular]: require('../../assets/fonts/Archivo-Regular.ttf'),
  [fonts.italic]: require('../../assets/fonts/Archivo-Italic.ttf'),
  [fonts.semiBold]: require('../../assets/fonts/Archivo-SemiBold.ttf'),
  [fonts.condensed]: require('../../assets/fonts/ArchivoCondensed-ExtraBold.ttf'),
};

export type TextStyleName = 'display' | 'largeTitle' | 'title' | 'headline' | 'body' | 'subheadline' | 'footnote';

/**
 * DESIGN_SYSTEM §2. Condensed is for plant names and screen titles only. Tracking is em × size.
 * Sizes are defaults; the system text-size setting scales them (never capped).
 */
export const typography: Record<TextStyleName, TextStyle> = {
  display: { fontFamily: fonts.condensed, fontSize: 40, lineHeight: 40, letterSpacing: -0.4 },
  largeTitle: { fontFamily: fonts.condensed, fontSize: 32, lineHeight: 34, letterSpacing: -0.16 },
  title: { fontFamily: fonts.condensed, fontSize: 21, lineHeight: 24 },
  headline: { fontFamily: fonts.semiBold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 24 },
  subheadline: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 20 },
  footnote: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, letterSpacing: 0.065 },
};
