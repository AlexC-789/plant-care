import { useRouter } from 'expo-router';
import { SectionList, StyleSheet, View } from 'react-native';

import { deviceStatus, needsYou } from '@/devices/status';
import { PlantRow } from '@/plants/PlantRow';
import { usePlants } from '@/plants/queries';
import { space } from '@/theme';
import { Button, FadeIn, LoadingGroup, PotDrawing, SkeletonRow, Text } from '@/ui';

export default function Plants() {
  const router = useRouter();
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
  const plants = data?.pages.flatMap((p) => p.plants) ?? [];
  const photoUrls = Object.assign({}, ...(data?.pages.map((p) => p.photoUrls) ?? []));
  const now = new Date();
  const rows = plants.map((p) => ({ plant: p, status: deviceStatus(p.device, now) }));
  const need = rows.filter((r) => needsYou(r.status));
  const well = rows.filter((r) => !needsYou(r.status));
  const sections = [
    { title: 'Needs you', data: need },
    { title: 'Doing well', data: well },
  ].filter((s) => s.data.length);
  const summary = [need.length && `${need.length} need you`, well.length && `${well.length} doing well`]
    .filter(Boolean)
    .join(' · ');
  const add = () => router.push('/add/photo');

  // Shown in place of rows: skeleton while loading, the error with no cache, or the empty state.
  const placeholder = data ? (
    <View style={styles.empty}>
      <PotDrawing />
      <Text variant="title3" accessibilityRole="header" style={styles.center}>
        No plants yet
      </Text>
      <Text variant="subheadline" color="secondaryLabel" style={styles.center}>
        {"Add your first pot and it'll look after its own watering from then on."}
      </Text>
      <Button label="Add a pot" onPress={add} />
    </View>
  ) : isError ? (
    <View style={styles.empty}>
      <Text variant="subheadline" color="secondaryLabel" style={styles.center}>
        {"Couldn't reach Plant Care. Check your connection and try again."}
      </Text>
      <Button label="Try again" variant="bordered" onPress={() => void refetch()} />
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
      keyExtractor={(r) => r.plant.id}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) =>
        need.length && well.length ? (
          <Text variant="footnote" color="secondaryLabel" style={styles.header}>
            {section.title}
          </Text>
        ) : null
      }
      renderItem={({ item }) => (
        <FadeIn>
          <PlantRow
            plant={item.plant}
            status={item.status}
            photoUrl={photoUrls[item.plant.photo_path ?? '']}
            onPress={() => router.push(`/plant/${item.plant.id}`)}
          />
        </FadeIn>
      )}
      ItemSeparatorComponent={() => <View style={{ height: space.s }} />}
      ListHeaderComponent={
        plants.length ? (
          <Text variant="subheadline" color="secondaryLabel" style={styles.summary}>
            {summary}
          </Text>
        ) : undefined
      }
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
  container: { flexGrow: 1, padding: space.l },
  summary: { marginBottom: space.m },
  header: { marginTop: space.s, marginBottom: space.s },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s,
    paddingBottom: space.xxxl * 2,
  },
  center: { textAlign: 'center' },
});
