import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { CaptureCards, type CaptureCard, type Photo } from '@/plants/CaptureCards';
import { deletePhotos } from '@/plants/photos';
import { useCheckHealth } from '@/plants/queries';
import { radius, space, useTheme } from '@/theme';
import { BottomBar, Button, FadeIn, Icon, Text } from '@/ui';

const CARDS: CaptureCard[] = [
  {
    kind: 'whole',
    title: 'Whole plant',
    hint: 'Step back so the whole plant and pot fit',
  },
  {
    kind: 'problem',
    title: 'Problem spot',
    hint: 'If something looks wrong',
    optional: true,
  },
];
const STATUS = {
  true: { icon: 'healthy', color: 'statusFine', label: 'Looks healthy' },
  false: { icon: 'error', color: 'statusSoon', label: 'Needs attention' },
  null: { icon: 'unsure', color: 'statusQuiet', label: 'Not sure' },
} as const;
// The server's own message for a 429; any other failure reads as "couldn't check".
const LIMIT = "You've reached the health check limit for now. Try again later.";

export default function Health() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const check = useCheckHealth();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const latest = useRef<Photo[]>([]);
  const kept = useRef(false);
  const [error, setError] = useState<string | null>(null);

  // Uploads only live on as part of a finished check; leaving earlier deletes them.
  useEffect(
    () => () => {
      if (!kept.current) void deletePhotos(latest.current.map((p) => p.path)).catch(() => {});
    },
    [],
  );

  const change = (next: Photo[]) => {
    latest.current = next;
    setPhotos(next);
  };
  const run = () => {
    setError(null);
    check.mutate(
      { plantId: id, photoPaths: photos.map((p) => p.path) },
      {
        onSuccess: () => (kept.current = true),
        onError: (e) => setError(e.message === LIMIT ? LIMIT : "Couldn't check right now. Try again."),
      },
    );
  };

  const { colors } = useTheme();
  const result = check.data;
  // The photo that was checked: the problem spot if there is one, else the whole plant.
  const status = STATUS[`${result?.healthy}` as keyof typeof STATUS];
  const shown = photos.find((p) => p.kind === 'problem') ?? photos[0];
  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ title: 'Check its health' }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        {result ? (
          <FadeIn style={styles.result}>
            {shown ? (
              <Image
                accessibilityLabel="Checked photo"
                source={{ uri: shown.localUri }}
                style={styles.photo}
              />
            ) : null}
            <View style={styles.status}>
              <Icon
                name={status.icon}
                size={18}
                color={status.color}
              />
              <Text variant="subheadline" color={status.color}>
                {status.label}
              </Text>
            </View>
            <Text variant="title3" accessibilityRole="header">
              {result.note}
            </Text>
            {result.advice ? (
              <View style={[styles.card, { backgroundColor: colors.surface }]}>
                <View style={styles.status}>
                  <Icon name="care" size={18} color="tint" />
                  <Text variant="headline" accessibilityRole="header">
                    What to do
                  </Text>
                </View>
                <Text variant="body">{result.advice}</Text>
              </View>
            ) : null}
          </FadeIn>
        ) : (
          <>
            <CaptureCards cards={CARDS} photos={photos} onChange={change} />
            {check.isPending ? (
              <Text variant="footnote" accessibilityLiveRegion="polite">
                Looking at your plant…
              </Text>
            ) : null}
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
          <Button label="Done" onPress={() => router.back()} />
        ) : (
          <Button
            label="Check"
            busy={check.isPending}
            disabled={!photos.some((p) => p.kind === 'whole') || check.isPending}
            onPress={run}
          />
        )}
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  result: { gap: space.l },
  photo: { aspectRatio: 4 / 3, borderRadius: radius.thumb },
  status: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  card: { borderRadius: radius.group, padding: space.l, gap: space.s },
  content: { padding: space.l, gap: space.l },
});
