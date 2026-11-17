import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import Svg, { Path, type PathProps } from 'react-native-svg';

import { useReduceMotion, useTheme } from '@/theme';
import { POT_PATHS } from '@/ui/PotDrawing';

export const LAUNCH_DURATION_MS = 700;
const REDUCED_DURATION_MS = 300;
const FADE_OUT_MS = 250;
const REDUCED_FADE_OUT_MS = 150;
const DRAW_WIDTH = 160;
/** Longer than any stroke in the drawing, so offset = DASH hides a stroke fully. */
const DASH = 400;

// Animated adds a native-only `collapsable` prop; drop it so web doesn't put it on <path>.
function PathWithoutCollapsable({
  collapsable: _collapsable,
  ...props
}: PathProps & { collapsable?: boolean; ref?: React.Ref<Path> }) {
  return <Path {...props} />;
}
const AnimatedPath = Animated.createAnimatedComponent(PathWithoutCollapsable);

/**
 * Cold-start logo moment: the pot drawing sketches itself in (body, then leaves),
 * ~700 ms, ease-out, no bounce. Reduce Motion: the drawing simply fades in (~300 ms).
 * The same drawing is on the native splash, so the hand-off is seamless.
 */
type Props = {
  onDone: () => void;
  /** Start fading the overlay out into the first screen. */
  fadingOut?: boolean;
  onExited?: () => void;
  /** First frame laid out: safe to hide the native splash. */
  onReady?: () => void;
};

export function LaunchAnimation({ onDone, fadingOut = false, onExited, onReady }: Props) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const [overlayOpacity] = useState(() => new Animated.Value(1));
  const [ready, setReady] = useState(false);
  const [body] = useState(() => POT_PATHS.body.map(() => new Animated.Value(DASH)));
  const [leaves] = useState(() => POT_PATHS.leaves.map(() => new Animated.Value(DASH)));
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const draw = (value: Animated.Value, duration: number) =>
      Animated.timing(value, {
        toValue: 0,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false, // SVG stroke props aren't supported by the native driver
      });

    const animation = reduceMotion
      ? Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: REDUCED_DURATION_MS, useNativeDriver: false }),
          ...[...body, ...leaves].map((v) => draw(v, 0)),
        ])
      : Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: false }),
          Animated.stagger(40, body.map((v) => draw(v, 400))),
          Animated.sequence([
            Animated.delay(420),
            Animated.stagger(60, leaves.map((v) => draw(v, 160))),
          ]),
        ]);

    animation.start(({ finished }) => {
      if (finished) onDone();
    });
    return () => animation.stop();
  }, [reduceMotion, body, leaves, opacity, onDone]);

  useEffect(() => {
    if (!fadingOut) return;
    const fade = Animated.timing(overlayOpacity, {
      toValue: 0,
      duration: reduceMotion ? REDUCED_FADE_OUT_MS : FADE_OUT_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false, // same driver as the drawing it fades
    });
    fade.start(({ finished }) => {
      if (finished) onExited?.();
    });
    return () => fade.stop();
  }, [fadingOut, reduceMotion, overlayOpacity, onExited]);

  return (
    <Animated.View
      testID="launch"
      accessible
      accessibilityLabel="Plant Care"
      accessibilityViewIsModal
      pointerEvents={fadingOut ? 'none' : 'auto'}
      onLayout={() => {
        if (ready) return;
        setReady(true);
        onReady?.();
      }}
      style={[
        StyleSheet.absoluteFill,
        styles.center,
        { backgroundColor: colors.background, opacity: overlayOpacity },
      ]}>
      <Animated.View style={{ opacity }}>
        <Svg
          width={DRAW_WIDTH}
          height={(DRAW_WIDTH * 140) / 160}
          viewBox="0 0 160 140"
          fill="none"
          stroke={colors.secondaryLabel}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round">
          {POT_PATHS.body.map((d, i) => (
            <AnimatedPath key={d} d={d} strokeDasharray={DASH} strokeDashoffset={body[i]} />
          ))}
          {POT_PATHS.leaves.map((d, i) => (
            <AnimatedPath key={d} d={d} strokeDasharray={DASH} strokeDashoffset={leaves[i]} />
          ))}
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', zIndex: 10 },
});
