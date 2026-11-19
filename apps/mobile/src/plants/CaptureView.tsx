import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, space, useTheme } from '@/theme';
import { Button, Frosted, Text } from '@/ui';

import { DENIED, pickPhoto } from './pickPhoto';

const TIPS = ['Stand back so the whole plant fits, pot included.', 'Daylight works best.', 'One plant per photo.'];
const FAILED = "Couldn't use that photo. Try again.";

/**
 * The capture step's camera (DESIGN_SYSTEM §8), photo mode: corner marks, Photos (library) and the
 * shutter. `onCapture` gets the raw photo's uri; the 3D scan becomes a second mode here, same output.
 */
export function CaptureView({
  busy,
  failed,
  onCapture,
  onClose,
}: {
  busy: boolean;
  failed: boolean;
  onCapture: (uri: string) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const { top, bottom } = useSafeAreaInsets();
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [tips, setTips] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Asked here, when the person chose to add a plant, never at launch.
  useEffect(() => {
    if (permission?.status === 'undetermined') void requestPermission();
  }, [permission?.status, requestPermission]);
  const denied = permission?.status === 'denied';

  const shoot = async () => {
    setMessage(null);
    try {
      const photo = await camera.current?.takePictureAsync();
      if (photo?.uri) onCapture(photo.uri);
    } catch {
      setMessage(FAILED);
    }
  };
  const choose = async () => {
    setMessage(null);
    try {
      const picked = await pickPhoto('library');
      if (picked.denied) setMessage(DENIED.library);
      else if (picked.uri) onCapture(picked.uri);
    } catch {
      setMessage(FAILED);
    }
  };
  const error = message ?? (failed ? FAILED : null);

  if (denied) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background, paddingTop: top + space.xs }]}>
        <View style={styles.bar}>
          <Frosted label="Close" icon="close" onPress={onClose} />
        </View>
        <View style={styles.denied}>
          <Text variant="title" accessibilityRole="header">
            Plant Care needs the camera to see your plant.
          </Text>
          {error ? (
            <Text variant="footnote" color="statusNow" accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          <Button label="Open Settings" onPress={() => void Linking.openSettings()} />
          <Button label="Choose a photo instead" variant="line" busy={busy} disabled={busy} onPress={() => void choose()} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.camera }]}>
      {permission?.granted ? <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" mute /> : null}
      <View pointerEvents="none" style={[styles.frame, { top: top + 72, bottom: bottom + 196 }]}>
        {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
          <View key={c} style={[styles.corner, corners[c], { borderColor: colors.onCamera }]} />
        ))}
      </View>
      <View style={[styles.bar, { position: 'absolute', top: top + space.xs, left: 0, right: 0 }]}>
        <Frosted label="Close" icon="close" onPress={onClose} />
        <Frosted label="Tips" icon="help" onPress={() => setTips(!tips)} />
      </View>
      {tips ? (
        <View style={[styles.tips, { top: top + 64, backgroundColor: colors.surface }]}>
          {TIPS.map((t) => (
            <Text key={t} variant="subheadline">
              {t}
            </Text>
          ))}
        </View>
      ) : null}
      <View style={[styles.controls, { paddingBottom: bottom + space.xxxl }]}>
        {error ? (
          <Text variant="subheadline" color="onCamera" accessibilityRole="alert" style={styles.center}>
            {error}
          </Text>
        ) : null}
        <Text variant="headline" color="onCamera" style={styles.center}>
          Fit the whole plant in the frame
        </Text>
        <View style={styles.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Photos"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={() => void choose()}
            style={styles.side}>
            <Text variant="headline" color="onCamera">
              Photos
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Take photo"
            accessibilityState={{ disabled: busy || !permission?.granted, busy }}
            disabled={busy || !permission?.granted}
            onPress={() => void shoot()}
            style={({ pressed }) => [styles.shutter, { borderColor: colors.onCamera }, pressed && styles.pressed]}>
            {busy ? (
              <ActivityIndicator color={colors.onCamera} />
            ) : (
              <View style={[styles.disc, { backgroundColor: colors.onCamera }]} />
            )}
          </Pressable>
          <View style={styles.side} />
        </View>
      </View>
    </View>
  );
}

const MARK = 28;
const corners = StyleSheet.create({
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
});
const styles = StyleSheet.create({
  flex: { flex: 1 },
  bar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.xl },
  denied: { flex: 1, justifyContent: 'center', padding: space.xl, gap: space.l },
  frame: { position: 'absolute', left: space.xxxl, right: space.xxxl },
  corner: { position: 'absolute', width: MARK, height: MARK, borderRadius: 2 },
  tips: { position: 'absolute', left: space.xl, right: space.xl, padding: space.l, gap: space.s, borderRadius: radius.thumb },
  controls: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: space.xl, paddingHorizontal: space.xl },
  center: { textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  side: { width: 76, minHeight: space.touch, justifyContent: 'center' },
  shutter: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  disc: { width: 60, height: 60, borderRadius: 30 },
  pressed: { transform: [{ scale: 0.97 }] },
});
