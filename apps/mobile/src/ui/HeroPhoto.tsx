import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, space, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export const HERO_HEIGHT = 290;
// DESIGN_SYSTEM §3: the photo's top dissolves into the page, clear for 22 pt, eased to opaque by 164 pt.
// Drawn as a page-colour overlay with the inverse stops: [location, page-colour alpha].
const FADE_HEIGHT = 164;
const STOPS = [
  [0, 1],
  [22 / FADE_HEIGHT, 1],
  [0.4, 0.7],
  [0.6, 0.38],
  [0.8, 0.12],
  [1, 0],
] as const;

function Frosted({ label, icon, onPress }: { label: string; icon: IconName; onPress: () => void }) {
  const { scheme } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.frosted}>
      <BlurView intensity={40} tint={scheme} style={StyleSheet.absoluteFill} />
      <Icon name={icon} size={20} />
    </Pressable>
  );
}

/**
 * Full-width plant photo from the very top of the screen (DESIGN_SYSTEM §4). Frosted back and more
 * buttons sit in the fade; white pills on the bottom left name the room and, when it applies, the red state.
 */
export function HeroPhoto({
  uri,
  cacheKey,
  label,
  loading,
  pills,
  onBack,
  onMore,
  children,
}: {
  uri?: string;
  cacheKey?: string;
  label: string;
  loading: boolean;
  pills: { text: string; red?: boolean }[];
  onBack: () => void;
  onMore?: () => void;
  /** Shown when there is no photo (the pot drawing). */
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  const { top } = useSafeAreaInsets();
  const alpha = (a: number) => colors.background + Math.round(a * 255).toString(16).padStart(2, '0');
  const fade = STOPS.map(([, a]) => alpha(a)) as unknown as readonly [string, string, ...string[]];
  return (
    <View testID="plant-hero" style={[styles.hero, { backgroundColor: loading ? colors.skeleton : colors.surface }]}>
      {uri ? (
        <Image accessibilityLabel={label} source={{ uri, cacheKey }} contentFit="cover" style={StyleSheet.absoluteFill} />
      ) : (
        children
      )}
      <LinearGradient pointerEvents="none" colors={fade} locations={STOPS.map(([l]) => l) as unknown as readonly [number, number, ...number[]]} style={styles.fade} />
      <View style={[styles.buttons, { top: top + space.xs }]}>
        <Frosted label="Back" icon="back" onPress={onBack} />
        {onMore ? <Frosted label="More options" icon="more" onPress={onMore} /> : null}
      </View>
      {pills.length ? (
        <View testID="hero-pills" style={styles.pills}>
          {pills.map((p) => (
            <View key={p.text} style={[styles.pill, { backgroundColor: colors.surface }]}>
              <Text variant="footnote" color={p.red ? 'statusNow' : 'label'}>
                {p.text}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { height: HERO_HEIGHT, width: '100%', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  fade: { position: 'absolute', top: 0, left: 0, right: 0, height: FADE_HEIGHT },
  buttons: { position: 'absolute', left: space.xl, right: space.xl, flexDirection: 'row', justifyContent: 'space-between' },
  frosted: {
    width: space.touch,
    height: space.touch,
    borderRadius: radius.capsule,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pills: { position: 'absolute', left: space.xl, right: space.xl, bottom: space.m, flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  pill: { borderRadius: radius.capsule, paddingHorizontal: space.m, paddingVertical: space.xs },
});
