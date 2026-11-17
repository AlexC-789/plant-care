/**
 * Colour tokens from the app UI design (docs/superpowers/specs/2026-11-17-app-ui-design.md §3).
 * The only place in the app where colour values are written.
 */
export type ColorToken =
  | 'background'
  | 'surface'
  | 'label'
  | 'secondaryLabel'
  | 'separator'
  | 'tint'
  | 'onTint'
  | 'statusFine'
  | 'statusSoon'
  | 'statusNow'
  | 'statusQuiet'
  | 'water'
  | 'waterFill'
  | 'band'
  | 'nowFill'
  | 'soonFill';

export type ColorScheme = 'light' | 'dark';
export type Palette = Record<ColorToken, string>;

export const colors: Record<ColorScheme, Palette> = {
  light: {
    background: '#F4F1EB',
    surface: '#FFFDF9',
    label: '#1D1B18',
    secondaryLabel: '#5E5950',
    separator: '#E3DDD3',
    tint: '#2E5B47',
    onTint: '#FFFFFF',
    statusFine: '#4A7545',
    statusSoon: '#8F6210',
    statusNow: '#A3392B',
    statusQuiet: '#56606A',
    water: '#3F6A82',
    waterFill: '#DCE7EC',
    band: '#668C60',
    nowFill: '#F7E4DF',
    soonFill: '#F6ECD6',
  },
  dark: {
    background: '#161412',
    surface: '#221F1B',
    label: '#F2EEE7',
    secondaryLabel: '#B5AEA3',
    separator: '#3A352F',
    tint: '#8FC0A4',
    onTint: '#0F2419',
    statusFine: '#8DBB86',
    statusSoon: '#E0B25A',
    statusNow: '#EF8A78',
    statusQuiet: '#A3AEB9',
    water: '#86B2C9',
    waterFill: '#2A3A42',
    band: '#6F9A69',
    nowFill: '#3A221D',
    soonFill: '#352A16',
  },
};
