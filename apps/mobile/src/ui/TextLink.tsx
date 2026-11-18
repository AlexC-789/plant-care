import { Link, type Href } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { space } from '@/theme';

import { Text } from './Text';

type Props = { label: string } & ({ href: Href; replace?: boolean; onPress?: never } | { onPress: () => void; href?: never; replace?: never });

/** Link text in the tint colour with a 44 pt tap target: navigates to `href`, or runs `onPress` (a button). */
export function TextLink({ href, label, replace, onPress }: Props) {
  const text = (
    <Pressable accessibilityRole={href ? 'link' : 'button'} onPress={onPress} style={styles.target} hitSlop={space.xs}>
      <Text variant="subheadline" color="tint">
        {label}
      </Text>
    </Pressable>
  );
  return href ? (
    <Link href={href} replace={replace} asChild>
      {text}
    </Link>
  ) : (
    text
  );
}

const styles = StyleSheet.create({
  target: { minHeight: space.touch, justifyContent: 'center', paddingHorizontal: space.s },
});
