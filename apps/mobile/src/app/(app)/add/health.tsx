import { Redirect, Stack, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';

import type { HealthResult as Result } from '@/plants/api';
import { useAddDraft } from '@/plants/addDraft';
import { HealthResult } from '@/plants/HealthResult';
import { deletePhotos } from '@/plants/photos';
import { useCheckHealth, useHealthCheckStatus } from '@/plants/queries';
import { space } from '@/theme';
import { BottomBar, Button, StepProgress, Text, TextLink } from '@/ui';

// The server's own message for a 429; any other failure reads as "couldn't check".
const LIMIT = "You've reached the health check limit for now. Try again later.";

/** Step 4 of 4: an optional health check. The plant already exists, so every way out keeps it. */
export default function HealthStep() {
  const router = useRouter();
  const { draft, set } = useAddDraft();
  const { plantId = '' } = draft;
  const check = useCheckHealth();
  const status = useHealthCheckStatus(plantId);

  const whole = draft.photos.find((p) => p.kind === 'whole');
  const problem = draft.photos.find((p) => p.kind === 'problem');
  // The ref guards re-runs of the effect; the draft flag survives a remount. One check, one credit.
  const started = useRef(!!draft.healthStarted);
  const run = () => {
    started.current = true;
    set({ healthStarted: true });
    check.mutate({ plantId, photoPaths: [whole, problem].flatMap((p) => (p ? [p.path] : [])) });
  };
  useEffect(() => {
    if (plantId && problem && !started.current) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- starts once on mount
  }, []);

  // The problem photo only lives on as part of a check; leaving before one started deletes it.
  const unused = useRef(problem?.path);
  useEffect(
    () => () => {
      if (!started.current && unused.current) void deletePhotos([unused.current]).catch(() => {});
    },
    [],
  );

  const done = () => {
    router.dismissTo('/');
    router.push(`/plant/${plantId}`);
  };
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => (done(), true));
    return () => sub.remove();
  });

  if (!plantId) return <Redirect href="/add/photo" />;

  const failed = status?.status === 'error';
  const result = status?.status === 'success' ? (status.data as Result) : undefined;
  // With a problem photo the check is about to start (or running); otherwise offer it.
  const offer = !result && status?.status !== 'pending' && (failed || !problem || draft.healthStarted);
  const error = failed ? (status.error?.message === LIMIT ? LIMIT : "Couldn't check right now.") : null;

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ headerRight: () => <TextLink label="Done" onPress={done} /> }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <StepProgress step={4} />
        {result ? (
          <HealthResult result={result} photoUri={(problem ?? whole)?.localUri} />
        ) : offer ? (
          <>
            <Text variant="title" accessibilityRole="header">
              Want a quick health check?
            </Text>
            {error ? (
              <Text variant="footnote" color="statusNow" accessibilityRole="alert">
                {error}
              </Text>
            ) : null}
          </>
        ) : (
          <Text variant="title" accessibilityLiveRegion="polite">
            Looking at your plant…
          </Text>
        )}
      </ScrollView>
      <BottomBar>
        {offer ? (
          <>
            <Button label={failed ? 'Try again' : 'Check its health now'} onPress={run} />
            <Button label="Skip for now" variant="plain" onPress={done} />
          </>
        ) : (
          <Button label="Done" onPress={done} />
        )}
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: space.l, gap: space.l },
});
