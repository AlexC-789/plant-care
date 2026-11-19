import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { linkScan } from '@/plants/api';
import { HealthText } from '@/plants/HealthResult';
import { useDeletePlantPhoto, useIdentify, usePlantPhotos, useUpdatePlant } from '@/plants/queries';
import { Suggestions } from '@/plants/Suggestions';
import { space } from '@/theme';
import { BottomBar, Button, LoadingGroup, Skeleton, Text } from '@/ui';

// Same copy as the add flow's identify step.
const COULDNT = "Couldn't tell from this photo. Try one with a whole leaf in view, or search.";
const LIMIT = "You've reached the identification limit for now. Search for the plant type, or try again later.";

/** Full-screen timeline: swipe through a plant's photos, see the check result, identify or delete one. */
export default function PhotoViewer() {
  const { id, start } = useLocalSearchParams<{ id: string; start?: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const timeline = usePlantPhotos(id);
  const del = useDeletePlantPhoto();
  const identify = useIdentify();
  const update = useUpdatePlant();
  const [index, setIndex] = useState<number | null>(null);
  // Horizontal list cells don't stretch to the list's height, so each page gets it explicitly.
  const [pageHeight, setPageHeight] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<{ scanId?: string; list: NonNullable<typeof identify.data>['suggestions'] } | null>(null);

  const photos = timeline.data?.pages.flatMap((p) => p.photos) ?? [];
  const urls = Object.assign({}, ...(timeline.data?.pages.map((p) => p.photoUrls) ?? []));
  const wanted = Number(start) || 0;
  const { hasNextPage, isFetchingNextPage, fetchNextPage, isFetchNextPageError: fetchFailed } = timeline;

  // A start index beyond the loaded pages: keep loading until it is there (or nothing is left).
  useEffect(() => {
    if (wanted >= photos.length && hasNextPage && !isFetchingNextPage && !fetchFailed) void fetchNextPage();
  }, [wanted, photos.length, hasNextPage, isFetchingNextPage, fetchFailed, fetchNextPage]);

  if (timeline.isError && !timeline.data) {
    return (
      <View style={styles.center}>
        <Text color="secondaryLabel">—</Text>
      </View>
    );
  }
  // a page that failed to load: show the photos already here (current clamps to the last one)
  if (!timeline.data || (wanted >= photos.length && hasNextPage && !fetchFailed)) {
    return (
      <LoadingGroup>
        <View style={styles.flex}>
          <Skeleton height={400} radius={0} />
        </View>
      </LoadingGroup>
    );
  }
  if (!photos.length) return <View style={styles.flex} />;

  const current = photos[Math.min(index ?? wanted, photos.length - 1)];
  const reset = (i: number) => {
    setIndex(i);
    setConfirming(false);
    setMessage(null);
    setSuggestions(null);
  };

  const remove = () =>
    del.mutate(
      { plantId: id, photo: { id: current.id, path: current.path } },
      {
        onSuccess: () => {
          setConfirming(false);
          if (photos.length <= 1) router.back();
        },
      },
    );

  const whatIsIt = () => {
    setMessage(null);
    setSuggestions(null);
    identify.mutate([current.path], {
      onSuccess: (r) =>
        r.isPlant && r.suggestions.length ? setSuggestions({ scanId: r.scanId, list: r.suggestions.slice(0, 3) }) : setMessage(COULDNT),
      onError: (e) => setMessage(e.message === LIMIT ? LIMIT : COULDNT),
    });
  };

  const pick = (speciesId: string) =>
    update.mutate(
      { id, patch: { species_id: speciesId, custom_type: null } },
      {
        onSuccess: () => {
          const scanId = suggestions?.scanId;
          setSuggestions(null);
          setMessage('Plant type updated.');
          if (scanId) void linkScan(scanId, id).catch(() => {}); // the type is set either way
        },
      },
    );

  return (
    <View style={styles.flex}>
      <FlatList
        testID="photo-list"
        style={styles.flex}
        onLayout={(e) => setPageHeight(e.nativeEvent.layout.height)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        data={photos}
        keyExtractor={(p) => p.id}
        getItemLayout={(_d, i) => ({ length: width, offset: width * i, index: i })}
        initialScrollIndex={Math.min(wanted, photos.length - 1)}
        onMomentumScrollEnd={(e) => reset(Math.round(e.nativeEvent.contentOffset.x / width))}
        onEndReached={() => hasNextPage && !isFetchingNextPage && void fetchNextPage()}
        renderItem={({ item }) => (
          <View style={{ width, height: pageHeight }}>
            <Image
              accessibilityLabel="Plant photo"
              source={{ uri: urls[item.path], cacheKey: item.path }}
              contentFit="contain"
              style={styles.flex}
            />
          </View>
        )}
      />
      <ScrollView style={styles.info} contentContainerStyle={styles.infoContent}>
        <Text variant="headline">
          {new Date(current.taken_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
        </Text>
        {current.health ? <HealthText result={current.health} /> : null}
        {message ? (
          <Text variant="footnote" accessibilityRole="alert" color={message === 'Plant type updated.' ? 'secondaryLabel' : 'statusNow'}>
            {message}
          </Text>
        ) : null}
        {suggestions ? (
          <Suggestions
            suggestions={suggestions.list}
            onPick={(s) => pick(s.speciesId)}
            onSearch={() => router.push(`/plant/${id}/edit`)}
          />
        ) : null}
      </ScrollView>
      <BottomBar>
        {confirming ? (
          <>
            <Text variant="body" accessibilityRole="alert">
              Delete this photo? This can&apos;t be undone.
            </Text>
            <Button label="Delete" variant="line" destructive busy={del.isPending} disabled={del.isPending} onPress={remove} />
            <Button label="Cancel" variant="plain" disabled={del.isPending} onPress={() => setConfirming(false)} />
          </>
        ) : (
          <>
            <Button label="What is it?" variant="line" busy={identify.isPending} disabled={identify.isPending} onPress={whatIsIt} />
            <Button label="Delete photo" variant="plain" onPress={() => setConfirming(true)} />
          </>
        )}
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  info: { flexGrow: 0, maxHeight: '45%' },
  infoContent: { padding: space.l, gap: space.m },
});
