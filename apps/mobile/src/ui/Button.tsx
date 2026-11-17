import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { radius, space, useTheme } from '@/theme';

import { Text } from './Text';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'prominent' | 'bordered' | 'plain';
  disabled?: boolean;
  busy?: boolean;
  destructive?: boolean;
};

/** Capsule button. Prominent = the one primary action on a screen. */
export function Button({
  label,
  onPress,
  variant = 'prominent',
  disabled = false,
  busy = false,
  destructive = false,
}: Props) {
  const { colors } = useTheme();
  const textColor =
    variant === 'prominent' ? 'onTint' : destructive ? 'statusNow' : 'tint';

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
        variant === 'bordered' && { borderWidth: StyleSheet.hairlineWidth * 2, borderColor: colors.tint },
        (pressed || disabled) && styles.dim,
      ]}>
      {busy ? <ActivityIndicator color={colors[textColor]} /> : null}
      <Text variant={variant === 'plain' ? 'body' : 'headline'} color={textColor}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: space.touch,
    borderRadius: radius.capsule,
    paddingHorizontal: space.xl,
    paddingVertical: space.m,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s,
  },
  dim: { opacity: 0.6 },
});
