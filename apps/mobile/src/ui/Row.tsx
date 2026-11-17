import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { space, useIsAccessibilitySize } from '@/theme';

import { Icon } from './Icon';
import { Text } from './Text';

type Props = {
  label: string;
  value?: string;
  accessory?: 'chevron' | 'checkmark' | 'none';
  onPress?: () => void;
  destructive?: boolean;
  /** Custom trailing content (e.g. a text field) in place of `value`. */
  children?: ReactNode;
  testID?: string;
};

/** One row in an InsetGroup. At accessibility text sizes the value wraps under the label. */
export function Row({ label, value, accessory = 'none', onPress, destructive, children, testID }: Props) {
  const stacked = useIsAccessibilitySize();
  const content = (
    <>
      <Text color={destructive ? 'statusNow' : 'label'} style={stacked ? undefined : styles.label}>
        {label}
      </Text>
      {children ??
        (value !== undefined ? (
          <Text color="secondaryLabel" style={stacked ? undefined : styles.value}>
            {value}
          </Text>
        ) : null)}
      {accessory === 'checkmark' ? <Icon name="checkmark" size={18} color="tint" /> : null}
      {accessory === 'chevron' && !stacked ? (
        <Icon name="chevronRight" size={14} color="secondaryLabel" />
      ) : null}
    </>
  );
  const style = [styles.row, stacked ? styles.stacked : styles.inline];

  if (!onPress) {
    return (
      <View style={style} testID={testID}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: accessory === 'checkmark' }}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [...style, pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: space.touch, paddingHorizontal: space.l, paddingVertical: space.m, gap: space.s },
  inline: { flexDirection: 'row', alignItems: 'center' },
  stacked: { flexDirection: 'column', alignItems: 'flex-start' },
  label: { flexShrink: 1 },
  value: { flex: 1, textAlign: 'right' },
  pressed: { opacity: 0.6 },
});
