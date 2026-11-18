import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AboutPlant } from '@/plants/AboutPlant';
import { HealthCard } from '@/plants/HealthCard';
import { signPhotoUrls } from '@/plants/photos';
import { useLatestHealth, usePlant, useSpecies } from '@/plants/queries';
import { TimelineStrip } from '@/plants/TimelineStrip';
import { radius, space, useTheme } from '@/theme';
import { Button, FadeIn, LoadingGroup, PotDrawing, Skeleton, SkeletonText, Text } from '@/ui';

function MenuButton({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  // On a photo the bare tint dots can vanish, so they sit on a surface disc.
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="More options"
      onPress={onPress}
      style={[styles.menuButton, { backgroundColor: colors.surface }]}>
      <Text variant="title3" color="tint">
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
          <Button
            label="Edit plant"
            variant="plain"
            onPress={() => (setMenu(false), router.push(`/plant/${id}/edit`))}
          />
        </View>
      ) : null}
      <View style={styles.body}>
        {plant ? (
          <FadeIn style={styles.stack}>
            <View style={styles.titles}>
              <Text variant="title" accessibilityRole="header">
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
            <View style={[styles.banner, { backgroundColor: colors.soonFill }]}>
              <Text variant="headline" color="statusSoon">
                {"Setup isn't finished"}
              </Text>
              <Text variant="subheadline">The module steps arrive in the next build.</Text>
            </View>
            <TimelineStrip plantId={id} />
            <HealthCard plantId={id} latest={health} />
            {species ? <AboutPlant species={species} /> : null}
          </FadeIn>
        ) : loading ? (
          <LoadingGroup>
            <SkeletonText variant="title" width="50%" />
            <SkeletonText variant="subheadline" width="35%" />
            <View style={styles.gap} />
            <Skeleton height={96} radius={radius.group} />
          </LoadingGroup>
        ) : (
          <Text variant="title" accessibilityRole="header">
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
  italic: { fontStyle: 'italic' },
  gap: { height: space.l },
  banner: { borderRadius: radius.group, padding: space.l, gap: space.xs },
  menuButton: { width: space.touch, height: space.touch, borderRadius: radius.capsule, alignItems: 'center', justifyContent: 'center' },
  menu: { position: 'absolute', right: space.l, borderRadius: radius.group, zIndex: 1 },
});
