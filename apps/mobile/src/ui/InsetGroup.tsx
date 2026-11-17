import { Children, Fragment, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { radius, space, useTheme } from '@/theme';

import { Text } from './Text';

/** iOS-style inset grouped section: rows on a rounded surface, hairlines between. */
export function InsetGroup({
  header,
  footer,
  children,
}: {
  header?: string;
  footer?: string;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  const rows = Children.toArray(children);
  return (
    <View style={styles.section}>
      {header ? (
        <Text variant="subheadline" color="secondaryLabel" style={styles.header}>
          {header}
        </Text>
      ) : null}
      <View style={[styles.group, { backgroundColor: colors.surface }]}>
        {rows.map((row, i) => (
          <Fragment key={i}>
            {i > 0 ? (
              <View style={[styles.separator, { backgroundColor: colors.separator }]} />
            ) : null}
            {row}
          </Fragment>
        ))}
      </View>
      {footer ? (
        <Text variant="footnote" color="secondaryLabel" style={styles.footer}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.s },
  header: { fontWeight: '600', marginHorizontal: space.xs },
  group: { borderRadius: radius.group, overflow: 'hidden' },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: space.l },
  footer: { marginHorizontal: space.xs },
});
