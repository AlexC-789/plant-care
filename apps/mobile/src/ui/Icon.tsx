import { SymbolView } from 'expo-symbols';

import { useTheme, type ColorToken } from '@/theme';

/** SF Symbol on iOS, the matching Material Symbol on Android and web. */
const SYMBOLS = {
  account: { ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' },
  checkmark: { ios: 'checkmark', android: 'check', web: 'check' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
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
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
