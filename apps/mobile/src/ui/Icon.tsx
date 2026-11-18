import { SymbolView } from 'expo-symbols';
import { Platform } from 'react-native';

import { useTheme, type ColorToken } from '@/theme';

/** SF Symbol on iOS, the matching Material Symbol on Android and web. */
const SYMBOLS = {
  account: { ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' },
  checkmark: { ios: 'checkmark', android: 'check', web: 'check' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  plus: { ios: 'plus', android: 'add', web: 'add' },
  light: { ios: 'sun.max', android: 'light_mode', web: 'light_mode' },
  water: { ios: 'drop', android: 'water_drop', web: 'water_drop' },
  healthy: { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' },
  unsure: { ios: 'questionmark.circle.fill', android: 'help', web: 'help' },
  care: { ios: 'leaf', android: 'eco', web: 'eco' },
  camera: { ios: 'camera', android: 'photo_camera', web: 'photo_camera' },
  error: { ios: 'exclamationmark.circle.fill', android: 'error', web: 'error' },
} as const;

export type IconName = keyof typeof SYMBOLS;

export function Icon({
  name,
  size = 22,
  color = 'label',
}: {
  name: IconName;
  size?: number;
  color?: ColorToken;
}) {
  const { colors } = useTheme();
  return (
    <SymbolView
      name={SYMBOLS[name]}
      size={size}
      tintColor={colors[color]}
      // Decorative: hidden from screen readers (the iOS prop isn't a valid web attribute).
      {...(Platform.OS === 'web'
        ? { 'aria-hidden': true }
        : { accessibilityElementsHidden: true, importantForAccessibility: 'no' as const })}
    />
  );
}
