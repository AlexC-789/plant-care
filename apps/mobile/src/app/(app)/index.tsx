import { useRouter, type Href } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';

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
  // shortcut: `as Href` until Tasks 10/11 add these routes (typed routes), then drop the casts.
  const add = () => router.push('/add/plant' as Href);

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
    <FlatList
      testID="plants-list"
      data={plants}
      keyExtractor={(p) => p.id}
      renderItem={({ item }) => (
        <FadeIn>
          <PlantRow
            plant={item}
            photoUrl={photoUrls[item.photo_path ?? '']}
            onPress={() => router.push(`/plant/${item.id}` as Href)}
          />
        </FadeIn>
      )}
      ItemSeparatorComponent={() => <View style={{ height: space.s }} />}
      ListHeaderComponent={
        plants.length ? (
          <Text variant="subheadline" color="secondaryLabel" style={styles.summary}>
            {plants.length} need you
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
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s,
    paddingBottom: space.xxxl * 2,
  },
  center: { textAlign: 'center' },
});
