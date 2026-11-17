import { Link, type Href } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { space } from '@/theme';

import { Text } from './Text';

/** In-app navigation link in the tint colour, with a 44 pt tap target. */
export function TextLink({ href, label, replace }: { href: Href; label: string; replace?: boolean }) {
  return (
    <Link href={href} replace={replace} asChild>
      <Pressable accessibilityRole="link" style={styles.target} hitSlop={space.xs}>
        <Text variant="subheadline" color="tint">
          {label}
        </Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  target: { minHeight: space.touch, justifyContent: 'center', paddingHorizontal: space.s },
});
