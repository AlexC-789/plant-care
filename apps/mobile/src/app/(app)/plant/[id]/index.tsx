import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AboutPlant } from '@/plants/AboutPlant';
import { HealthCard } from '@/plants/HealthCard';
import { signPhotoUrls } from '@/plants/photos';
import { useLatestHealth, usePlant, useSpecies } from '@/plants/queries';
import { radius, space, useTheme } from '@/theme';
import { Button, FadeIn, LoadingGroup, PotDrawing, Skeleton, SkeletonText, Text } from '@/ui';

const HERO = 280;

function MenuButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="More options" onPress={onPress} style={styles.menuButton}>
      <Text variant="title3" color="tint">
        …
      </Text>
    </Pressable>
  );
}

export default function PlantDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
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
  const subtitle = [type, plant?.room].filter(Boolean).join(' · ');

  return (
    <ScrollView contentInsetAdjustmentBehavior="never" contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title: '',
          headerTransparent: true,
          headerRight: plant ? () => <MenuButton onPress={() => setMenu((m) => !m)} /> : undefined,
        }}
      />
      <View
        style={[
          styles.hero,
          { backgroundColor: !plant || (path && !photoUrl) ? colors.skeleton : colors.surface },
        ]}>
        {photoUrl && path ? (
          <Image
            accessibilityLabel={`${plant.name} photo`}
            source={{ uri: photoUrl, cacheKey: path }}
            style={StyleSheet.absoluteFill}
          />
        ) : plant && !path ? (
          <PotDrawing />
        ) : null}
      </View>
      {menu && plant ? (
        <View style={[styles.menu, { backgroundColor: colors.surface }]}>
          <Button
            label="Edit plant"
            variant="plain"
            // shortcut: `as Href` until Task 12 adds the edit route (typed routes), then drop the cast.
            onPress={() => (setMenu(false), router.push(`/plant/${id}/edit` as Href))}
          />
        </View>
      ) : null}
      <View style={styles.body}>
        {plant ? (
          <FadeIn style={styles.stack}>
            <Text variant="title" accessibilityRole="header">
              {plant.name}
            </Text>
            {subtitle ? (
              <Text variant="subheadline" color="secondaryLabel">
                {subtitle}
              </Text>
            ) : null}
            <View style={[styles.banner, { backgroundColor: colors.soonFill }]}>
              <Text variant="headline" color="statusSoon">
                {"Setup isn't finished"}
              </Text>
              <Text variant="subheadline">The module steps arrive in the next build.</Text>
            </View>
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
  hero: { height: HERO, width: '100%', alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' },
  body: { padding: space.l, gap: space.l },
  stack: { gap: space.l },
  gap: { height: space.l },
  banner: { borderRadius: radius.group, padding: space.l, gap: space.xs },
  menuButton: { width: space.touch, height: space.touch, alignItems: 'center', justifyContent: 'center' },
  menu: { position: 'absolute', top: space.xxxl * 2, right: space.l, borderRadius: radius.group, zIndex: 1 },
});
