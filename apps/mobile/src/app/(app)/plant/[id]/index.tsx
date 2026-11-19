import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ModuleCard } from '@/devices/ModuleCard';
import { useDevice, useRemoveDevice } from '@/devices/queries';
import { StatusBanner } from '@/devices/StatusBanner';
import { deviceStatus } from '@/devices/status';
import { AboutPlant } from '@/plants/AboutPlant';
import { HealthCard } from '@/plants/HealthCard';
import { signPhotoUrls } from '@/plants/photos';
import { useLatestHealth, usePlant, useSpecies } from '@/plants/queries';
import { TimelineStrip } from '@/plants/TimelineStrip';
import { fonts, radius, space, useTheme } from '@/theme';
import { Button, FadeIn, LoadingGroup, PotDrawing, Skeleton, SkeletonRow, SkeletonText, Text } from '@/ui';

function MenuButton({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  // On a photo the bare tint dots can vanish, so they sit on a surface disc.
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="More options"
      onPress={onPress}
      style={[styles.menuButton, { backgroundColor: colors.surface }]}>
      <Text variant="title" color="tint">
        …
      </Text>
    </Pressable>
  );
}

const HERO_MAX = 460;

export default function PlantDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { top } = useSafeAreaInsets();
  const [menu, setMenu] = useState(false);
  const [removing, setRemoving] = useState(false);
  const deviceQuery = useDevice(id, 30_000);
  const removeModule = useRemoveDevice(id);
  const device = deviceQuery.data ?? null;
  const status = deviceStatus(device, new Date());
  const closeMenu = () => (setMenu(false), setRemoving(false));
  const { data: plant, isPending: loading } = usePlant(id);
  const species = useSpecies(plant?.species_id).data;
  const health = useLatestHealth(id).data;
  const path = plant?.photo_path;
  const photoUrl = useQuery({
    queryKey: ['photo', path],
    enabled: !!path,
    queryFn: () => signPhotoUrls([path!]).then((u) => u[path!]),
  }).data;

  const type = species?.common_names[0] ?? species?.scientific_name ?? plant?.custom_type;
  // A type that only repeats the name adds nothing: show the scientific name instead.
  const sameAsName = type?.toLowerCase() === plant?.name.toLowerCase();
  const subtitle = sameAsName ? species?.scientific_name : type;

  return (
    <ScrollView contentInsetAdjustmentBehavior="never" contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title: '',
          headerTransparent: true,
          // The app-wide headerStyle colour would win over headerTransparent and paint a band above the photo.
          headerStyle: { backgroundColor: 'transparent' },
          headerRight: plant ? () => <MenuButton onPress={() => setMenu((m) => !m)} /> : undefined,
        }}
      />
      <View
        testID="plant-hero"
        style={[
          styles.hero,
          { height: Math.min(Math.round(width * 1.25), HERO_MAX) },
          { backgroundColor: (!plant && loading) || (path && !photoUrl) ? colors.skeleton : colors.surface },
        ]}>
        {photoUrl && path ? (
          <Image
            accessibilityLabel={`${plant.name} photo`}
            source={{ uri: photoUrl, cacheKey: path }}
            contentFit="cover"
            style={StyleSheet.absoluteFill}
          />
        ) : plant && !path ? (
          <PotDrawing />
        ) : null}
      </View>
      {menu && plant ? (
        <View style={[styles.menu, { top: top + space.touch, backgroundColor: colors.surface }]}>
          {removing && device ? (
            <View style={styles.confirm}>
              <Text>Remove the module? Its history is deleted. The module forgets this account at its next check-in.</Text>
              <Button
                label="Remove"
                destructive
                busy={removeModule.isPending}
                onPress={() => removeModule.mutate(device.id, { onSuccess: closeMenu })}
              />
              <Button label="Cancel" variant="plain" onPress={() => setRemoving(false)} />
            </View>
          ) : (
            <>
              <Button label="Edit plant" variant="plain" onPress={() => (closeMenu(), router.push(`/plant/${id}/edit`))} />
              {device ? <Button label="Remove module" variant="plain" destructive onPress={() => setRemoving(true)} /> : null}
            </>
          )}
        </View>
      ) : null}
      <View style={styles.body}>
        {plant ? (
          <FadeIn style={styles.stack}>
            <View style={styles.titles}>
              <Text variant="display" accessibilityRole="header">
                {plant.name}
              </Text>
              {subtitle || plant.room ? (
                <Text variant="subheadline" color="secondaryLabel">
                  {subtitle ? <Text style={sameAsName ? styles.italic : undefined}>{subtitle}</Text> : null}
                  {subtitle && plant.room ? ' · ' : null}
                  {plant.room}
                </Text>
              ) : null}
            </View>
            {deviceQuery.isPending ? (
              <LoadingGroup>
                <SkeletonRow />
                <SkeletonRow />
              </LoadingGroup>
            ) : deviceQuery.isError && !deviceQuery.data ? (
              <ModuleCard device={null} />
            ) : (
              <>
                <StatusBanner status={status} device={device} plantId={id} />
                {device ? <ModuleCard device={device} /> : null}
              </>
            )}
            <TimelineStrip plantId={id} />
            <HealthCard plantId={id} latest={health} />
            {species ? <AboutPlant species={species} /> : null}
          </FadeIn>
        ) : loading ? (
          <LoadingGroup>
            <SkeletonText variant="display" width="50%" />
            <SkeletonText variant="subheadline" width="35%" />
            <View style={styles.gap} />
            <Skeleton height={96} radius={radius.group} />
          </LoadingGroup>
        ) : (
          <Text variant="display" accessibilityRole="header">
            —
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: space.xxxl },
  hero: { width: '100%', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  body: { padding: space.l, gap: space.l },
  stack: { gap: space.xxl },
  titles: { gap: space.xs },
  italic: { fontFamily: fonts.italic },
  gap: { height: space.l },
  confirm: { padding: space.l, gap: space.s, maxWidth: 280 },
  menuButton: { width: space.touch, height: space.touch, borderRadius: radius.capsule, alignItems: 'center', justifyContent: 'center' },
  menu: { position: 'absolute', right: space.l, borderRadius: radius.group, zIndex: 1 },
});
