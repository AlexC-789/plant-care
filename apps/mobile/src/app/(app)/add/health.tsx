import { Redirect, Stack, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, BackHandler, Platform, ScrollView, StyleSheet, View } from 'react-native';

import type { HealthResult as Result } from '@/plants/api';
import { plantName, useAddDraft } from '@/plants/addDraft';
import { HealthResult } from '@/plants/HealthResult';
import { useCheckHealth, useHealthCheckStatus } from '@/plants/queries';
import { radius, space } from '@/theme';
import { BottomBar, Button, StepProgress, Text, TextLink } from '@/ui';

// The server's own message for a 429; any other failure reads as "couldn't check".
const LIMIT = "You've reached the health check limit for now. Try again later.";

/** Step 3 of 3: an optional health check of the capture. The plant already exists, so every way out keeps it. */
export default function HealthStep() {
  const router = useRouter();
  const { draft } = useAddDraft();
  const { plantId = '', capture } = draft;
  const check = useCheckHealth();
  const status = useHealthCheckStatus(plantId);

  const busy = useRef(false); // two taps in one frame start one check
  const run = () => {
    if (busy.current || !capture) return;
    busy.current = true;
    check.mutate({ plantId, photoPaths: [capture.path] }, { onSettled: () => (busy.current = false) });
  };

  const done = () => router.replace('/add/module-offer');
  useEffect(() => {
    if (Platform.OS === 'web') return; // react-native-web's BackHandler throws
    const sub = BackHandler.addEventListener('hardwareBackPress', () => (done(), true));
    return () => sub.remove();
  });

  const failed = status?.status === 'error';
  const result = status?.status === 'success' ? (status.data as Result) : undefined;
  const error = failed ? (status.error?.message === LIMIT ? LIMIT : "Couldn't check right now.") : null;
  // iOS ignores accessibilityLiveRegion, so announce the outcome explicitly (as StepDone does).
  const spoken = result?.note ?? error;
  useEffect(() => {
    if (spoken && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(spoken);
  }, [spoken]);

  if (!plantId) return <Redirect href="/add/capture" />;

  const running = status?.status === 'pending';
  const photo = <Image accessibilityLabel="Your plant" source={{ uri: capture?.localUri }} style={styles.photo} />;

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ headerRight: () => <TextLink label="Done" onPress={done} /> }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <StepProgress step={3} total={3} />
        {result ? (
          <HealthResult result={result} photoUri={capture?.localUri} />
        ) : running ? (
          <>
            {photo}
            <Text variant="largeTitle" accessibilityLiveRegion="polite">
              Looking at your plant…
            </Text>
          </>
        ) : (
          <>
            {photo}
            <Text variant="largeTitle" accessibilityRole="header">
              {`Want a quick health check for ${plantName(draft)}?`}
            </Text>
            <Text variant="footnote" color="secondaryLabel">
              {"We'll look at your photo for signs of pests, disease or stress. It takes a few seconds."}
            </Text>
            {error ? (
              <Text variant="footnote" color="statusNow" accessibilityRole="alert">
                {error}
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>
      <BottomBar>
        {result ? (
          <Button label="Done" onPress={done} />
        ) : running ? null : (
          <>
            <Button label={failed ? 'Try again' : 'Check its health now'} onPress={run} />
            <Button label="Skip for now" variant="plain" onPress={done} />
          </>
        )}
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: space.l, gap: space.l },
  photo: { aspectRatio: 4 / 3, borderRadius: radius.thumb },
});
