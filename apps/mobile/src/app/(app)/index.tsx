import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';

import { deviceStatus, needsYou, type Status, type StatusKey } from '@/devices/status';
import type { PlantWithDevice } from '@/plants/api';
import { PlantRow, PlantTile } from '@/plants/PlantRow';
import { usePlants } from '@/plants/queries';
import { space, useIsAccessibilitySize } from '@/theme';
import { Button, FadeIn, LoadingGroup, PotDrawing, SkeletonRow, Text } from '@/ui';

type Item = { plant: PlantWithDevice; status: Status };
// UX_ARCHITECTURE §6 order for the plants that need you.
const ORDER: StatusKey[] = ['fault', 'tank', 'offline', 'battery'];

/** Plants (Home), SCREEN_SPECIFICATIONS §11: "{n} need you" rows, then a "doing well" grid. */
export default function Plants() {
  const router = useRouter();
  const oneColumn = useIsAccessibilitySize();
  const {
    data,
    isPending,
    isError,
    isRefetching,
    isFetchingNextPage,
    hasNextPage,
    refetch,
    fetchNextPage,
  } = usePlants();
  // Refetch when returning to Home (it stays mounted under the stack); the first focus is covered by the mount fetch.
  const focused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focused.current) void refetch();
      focused.current = true;
    }, [refetch]),
  );
  const plants = data?.pages.flatMap((p) => p.plants) ?? [];
  const photoUrls: Record<string, string> = Object.assign({}, ...(data?.pages.map((p) => p.photoUrls) ?? []));
  const now = new Date();
  const items = plants.map((p) => ({ plant: p, status: deviceStatus(p.device, now) }));
  const need = items
    .filter((r) => needsYou(r.status))
    .sort((a, b) => ORDER.indexOf(a.status.key) - ORDER.indexOf(b.status.key));
  const well = items.filter((r) => !needsYou(r.status));
  const columns = oneColumn ? 1 : 2;
  const grid = Array.from({ length: Math.ceil(well.length / columns) }, (_, i) => well.slice(i * columns, (i + 1) * columns));
  // shortcut: counts are of the loaded pages; server-side counts come with the paging fix (known issue).
  const sections = [
    ...(need.length
      ? [{ key: 'need', title: `${need.length} ${need.length === 1 ? 'needs' : 'need'} you`, red: need.some((r) => r.status.level === 'now'), data: need.map((r) => [r]) }]
      : []),
    ...(well.length
      ? [{ key: 'well', title: need.length ? `${well.length} doing well` : `All ${well.length} doing well`, red: false, data: grid }]
      : []),
  ];
  const add = () => router.push('/add/capture');
  const open = (r: Item) => () => router.push(`/plant/${r.plant.id}`);
  const props = (r: Item) => ({ plant: r.plant, status: r.status, photoUrl: photoUrls[r.plant.photo_path ?? ''], onPress: open(r) });

  // Shown in place of rows: skeleton while loading, the error with no cache, or the empty state.
  const placeholder = data ? (
    <View style={styles.empty}>
      <PotDrawing />
      <Text variant="largeTitle" accessibilityRole="header" style={styles.center}>
        No plants yet
      </Text>
      <Text style={styles.center}>Scan a plant to add it.</Text>
      <Button label="Scan a plant" onPress={add} />
    </View>
  ) : isError ? (
    <View style={styles.empty}>
      <Text variant="subheadline" color="secondaryLabel" style={styles.center}>
        {"Couldn't reach Plant Care. Check your connection and try again."}
      </Text>
      <Button label="Try again" variant="line" onPress={() => void refetch()} />
    </View>
  ) : isPending ? (
    <LoadingGroup>
      <SkeletonRow />
      <SkeletonRow />
    </LoadingGroup>
  ) : null;

  return (
    <SectionList
      testID="plants-list"
      sections={sections}
      keyExtractor={(row) => row.map((r) => r.plant.id).join()}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => (
        <Text
          variant="headline"
          color={section.red ? 'statusNow' : 'label'}
          accessibilityRole="header"
          style={styles.header}>
          {section.title}
        </Text>
      )}
      renderItem={({ item, section }) => (
        <FadeIn>
          {section.key === 'need' ? (
            <PlantRow {...props(item[0])} />
          ) : (
            <View testID="grid-row" style={styles.gridRow}>
              {item.map((r) => (
                <PlantTile key={r.plant.id} {...props(r)} />
              ))}
              {item.length < columns ? <View style={styles.spacer} /> : null}
            </View>
          )}
        </FadeIn>
      )}
      ItemSeparatorComponent={() => <View style={{ height: space.l }} />}
      ListEmptyComponent={placeholder ?? undefined}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.container}
      refreshing={isRefetching && !isFetchingNextPage}
      onRefresh={() => void refetch()}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: space.xl, paddingBottom: space.xxxl },
  header: { marginTop: space.xl, marginBottom: space.m },
  gridRow: { flexDirection: 'row', gap: space.l },
  spacer: { flex: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s,
    paddingBottom: space.xxxl * 2,
  },
  center: { textAlign: 'center' },
});
