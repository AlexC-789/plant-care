import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, Linking, Pressable, StyleSheet, View } from 'react-native';

import { radius, space, useTheme } from '@/theme';
import { Button, LoadingGroup, Skeleton, Text, TextLink } from '@/ui';

import { preparePhoto } from './photos';
import { DENIED, pickPhoto, type PhotoSource } from './pickPhoto';
import { useAddPlantPhoto, useCheckHealth, useHealthCheckStatus, usePlantPhotos } from './queries';

// The server's own message for a 429; any other failure reads as "couldn't check".
const LIMIT = "You've reached the health check limit for now. Try again later.";

const THUMB = 72;
const SHORT = { day: 'numeric', month: 'short' } as const;

/** The plant's photo timeline (newest first, paged), plus "Add a photo" and the optional health check for it. */
export function TimelineStrip({ plantId }: { plantId: string }) {
  const router = useRouter();
  const { colors } = useTheme();
  const timeline = usePlantPhotos(plantId);
  const addPhoto = useAddPlantPhoto();
  const checkHealth = useCheckHealth();
  const health = useHealthCheckStatus(plantId);
  const [choosing, setChoosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState<PhotoSource | null>(null);
  const [failed, setFailed] = useState(false);
  const [offer, setOffer] = useState<string | null>(null);
  // Refs so a fast double tap can't start a second upload or health check before React re-renders.
  const adding = useRef(false);
  const checking = useRef(false);

  const photos = timeline.data?.pages.flatMap((p) => p.photos) ?? [];
  const urls = Object.assign({}, ...(timeline.data?.pages.map((p) => p.photoUrls) ?? []));
  const openViewer = (start: number) => router.push(`/plant/${plantId}/photos?start=${start}`);

  async function add(source: PhotoSource) {
    if (adding.current) return;
    adding.current = true;
    setBusy(true);
    setFailed(false);
    setDenied(null);
    try {
      const picked = await pickPhoto(source);
      if (picked.denied) return setDenied(source);
      if (!picked.uri) return;
      const photo = await preparePhoto(picked.uri);
      const path = await addPhoto.mutateAsync({ plantId, photo });
      checking.current = false;
      setOffer(path);
      setChoosing(false);
    } catch {
      setFailed(true);
    } finally {
      adding.current = false;
      setBusy(false);
    }
  }

  function check() {
    if (checking.current || !offer) return;
    checking.current = true;
    // The detail's health card shows progress and any error (incl. the daily limit); the photo stays either way.
    checkHealth.mutate({ plantId, photoPaths: [offer] });
    setOffer(null);
  }

  return (
    <View style={styles.section}>
      {timeline.isPending ? (
        <LoadingGroup>
          <View style={styles.row}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} width={THUMB} height={THUMB} radius={radius.thumb} />
            ))}
          </View>
        </LoadingGroup>
      ) : null}
      {timeline.isError && !timeline.data ? (
        <View style={styles.header}>
          <Text variant="headline" accessibilityRole="header">
            Timeline
          </Text>
          <Text color="secondaryLabel" accessibilityLabel="Timeline not loaded">
            —
          </Text>
        </View>
      ) : null}
      {photos.length ? (
        <>
          <View style={styles.header}>
            <Text variant="headline" accessibilityRole="header">
              Timeline
            </Text>
            <TextLink label="See all" onPress={() => openViewer(0)} />
          </View>
          <FlatList
            testID="timeline-list"
            horizontal
            data={photos}
            keyExtractor={(p) => p.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.row}
            onEndReached={() => {
              if (timeline.hasNextPage && !timeline.isFetchingNextPage) void timeline.fetchNextPage();
            }}
            renderItem={({ item, index }) => {
              const taken = new Date(item.taken_at);
              const dot = item.health && (item.health.healthy ? 'label' : item.health.healthy === false ? 'statusNow' : 'secondaryLabel');
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Photo from ${taken.toLocaleDateString(undefined, { ...SHORT, year: 'numeric' })}`}
                  onPress={() => openViewer(index)}
                  style={styles.item}>
                  <Image
                    testID="timeline-thumb"
                    source={{ uri: urls[item.path], cacheKey: item.path }}
                    contentFit="cover"
                    style={[styles.thumb, { backgroundColor: colors.skeleton }]}
                  />
                  {dot ? <View testID="timeline-dot" style={[styles.dot, { backgroundColor: colors[dot], borderColor: colors.surface }]} /> : null}
                  <Text variant="footnote" color="secondaryLabel">
                    {taken.toLocaleDateString(undefined, SHORT)}
                  </Text>
                </Pressable>
              );
            }}
          />
        </>
      ) : null}
      {offer ? (
        <View style={styles.stack}>
          <Text variant="subheadline">Added to the timeline.</Text>
          <Button label="Check its health" variant="line" onPress={check} />
          <Button label="Not now" variant="plain" onPress={() => setOffer(null)} />
        </View>
      ) : choosing ? (
        <View style={styles.stack}>
          <Button label="Take photo" variant="line" busy={busy} disabled={busy} onPress={() => void add('camera')} />
          <Button label="Choose from library" variant="line" disabled={busy} onPress={() => void add('library')} />
          <Button label="Cancel" variant="plain" disabled={busy} onPress={() => setChoosing(false)} />
        </View>
      ) : (
        <Button label="Add a photo" variant="line" onPress={() => setChoosing(true)} />
      )}
      {denied ? (
        <View style={styles.stack}>
          <Text variant="footnote" color="secondaryLabel">
            {DENIED[denied]}
          </Text>
          <Button label="Open Settings" variant="plain" onPress={() => void Linking.openSettings()} />
        </View>
      ) : null}
      {health?.status === 'pending' ? (
        <Text variant="subheadline" accessibilityLiveRegion="polite">
          Looking at your plant…
        </Text>
      ) : health?.status === 'error' ? (
        <Text variant="footnote" color="statusNow" accessibilityRole="alert">
          {health.error?.message === LIMIT ? LIMIT : "Couldn't check right now. Try again."}
        </Text>
      ) : null}
      {failed ? (
        <Text variant="footnote" color="statusNow" accessibilityRole="alert">
          {"Couldn't add that photo. Try again."}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.s },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', gap: space.s },
  stack: { gap: space.xs },
  item: { width: THUMB, gap: space.xs },
  thumb: { width: THUMB, height: THUMB, borderRadius: radius.thumb },
  dot: { position: 'absolute', top: space.xs, right: space.xs, width: 12, height: 12, borderRadius: radius.capsule, borderWidth: 2 },
});
