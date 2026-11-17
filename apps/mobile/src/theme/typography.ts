import { Platform, type TextStyle } from 'react-native';

/** The iOS system serif (New York), with the nearest equivalent elsewhere. */
export const serifFamily = Platform.select({
  ios: 'ui-serif',
  android: 'serif',
  default: 'ui-serif, "New York", "Iowan Old Style", Georgia, serif',
});

export type TextStyleName =
  | 'largeTitle'
  | 'title'
  | 'title3'
  | 'headline'
  | 'body'
  | 'callout'
  | 'subheadline'
  | 'footnote'
  | 'caption1';

/** Sizes are defaults; the system text-size setting scales them (never capped). */
export const typography: Record<TextStyleName, TextStyle> = {
  largeTitle: { fontFamily: serifFamily, fontSize: 34, lineHeight: 41, fontWeight: '500' },
  title: { fontFamily: serifFamily, fontSize: 28, lineHeight: 34, fontWeight: '500' },
  title3: { fontFamily: serifFamily, fontSize: 20, lineHeight: 25, fontWeight: '500' },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400' },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400' },
  subheadline: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  caption1: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
};
