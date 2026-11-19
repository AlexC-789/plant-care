/**
 * Colour tokens, Direction E (docs/design/DESIGN_SYSTEM.md §1): ink on a neutral page, blue only
 * for water, red only when a person must act. The only place in the app where colour values are written.
 * `waterFill` is the track (empty part of tank and water lines, inactive progress).
 */
export type ColorToken =
  | 'background'
  | 'surface'
  | 'label'
  | 'secondaryLabel'
  | 'separator'
  | 'tint'
  | 'onTint'
  | 'statusNow'
  | 'water'
  | 'waterFill'
  | 'skeleton'
  | 'skeletonHighlight'
  // Capture: the camera is black and its marks white in both schemes.
  | 'camera'
  | 'onCamera';

export type ColorScheme = 'light' | 'dark';
export type Palette = Record<ColorToken, string>;

export const colors: Record<ColorScheme, Palette> = {
  light: {
    background: '#F5F5F3',
    surface: '#FFFFFF',
    label: '#1F1F1F',
    secondaryLabel: '#66655F',
    separator: '#E3E3E0',
    tint: '#1F1F1F',
    onTint: '#FFFFFF',
    statusNow: '#D0213B',
    water: '#5FAEE3',
    waterFill: '#D9D8D4',
    skeleton: '#ECEBE8',
    skeletonHighlight: '#F5F5F3',
    camera: '#000000',
    onCamera: '#FFFFFF',
  },
  dark: {
    background: '#161616',
    surface: '#222221',
    label: '#F2F2F0',
    secondaryLabel: '#A3A29C',
    separator: '#2E2E2C',
    tint: '#F2F2F0',
    onTint: '#161616',
    statusNow: '#FF5C70',
    water: '#7CC0EE',
    waterFill: '#3A3A38',
    skeleton: '#262625',
    skeletonHighlight: '#2E2E2C',
    camera: '#000000',
    onCamera: '#FFFFFF',
  },
};
