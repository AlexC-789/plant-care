import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { radius, space, useTheme } from '@/theme';

import { Text } from './Text';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'prominent' | 'line' | 'plain';
  disabled?: boolean;
  busy?: boolean;
  destructive?: boolean;
};

/** Ink button (DESIGN_SYSTEM §4). Prominent = the one primary action; line = surface with a hairline; plain = ink text. */
export function Button({
  label,
  onPress,
  variant = 'prominent',
  disabled = false,
  busy = false,
  destructive = false,
}: Props) {
  const { colors } = useTheme();
  const textColor = variant === 'prominent' ? 'onTint' : destructive ? 'statusNow' : 'label';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === 'prominent' && { backgroundColor: colors.tint },
        variant === 'line' && {
          backgroundColor: colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.separator,
        },
        pressed && styles.pressed,
        disabled && styles.dim,
      ]}>
      {busy ? <ActivityIndicator color={colors[textColor]} /> : null}
      <Text variant="headline" color={textColor}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.button,
    paddingHorizontal: space.xl,
    paddingVertical: space.m,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s,
  },
  // DESIGN_SYSTEM §7: instant highlight on touch-down.
  pressed: { transform: [{ scale: 0.97 }] },
  dim: { opacity: 0.6 },
});
