import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDevice, useRemoveDevice, useResumeWatering } from '@/devices/queries';
import { deviceStatus, soilLabel } from '@/devices/status';
import { signPhotoUrls } from '@/plants/photos';
import { useDeletePlant, usePlant, useSpecies } from '@/plants/queries';
import { TimelineStrip } from '@/plants/TimelineStrip';
import { fonts, radius, space, useTheme } from '@/theme';
import {
  BottomBar,
  Button,
  FadeIn,
  HeroPhoto,
  LoadingGroup,
  PotDrawing,
  Row,
  Skeleton,
  SkeletonRow,
  SkeletonText,
  TankBar,
  Text,
} from '@/ui';

const SAUCER_TANK_ML = 705; // saucer v1, used when the module's own value isn't loaded

function Hairline() {
  const { colors } = useTheme();
  return <View style={[styles.hairline, { backgroundColor: colors.separator }]} />;
}

/** Plant page (SCREEN_SPECIFICATIONS §12). */
export default function PlantDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { top } = useSafeAreaInsets();
  const [menu, setMenu] = useState<null | 'open' | 'remove' | 'delete'>(null);
  const deviceQuery = useDevice(id, 30_000);
  const removeModule = useRemoveDevice(id);
  const resume = useResumeWatering(id);
  const deletePlant = useDeletePlant();
  const device = deviceQuery.data ?? null;
  // Load failed with nothing cached: show the module's rows with "—", never "No module yet".
  const deviceFailed = deviceQuery.isError && !deviceQuery.data;
  const known = !deviceQuery.isPending && !deviceFailed;
  const status = deviceStatus(device, new Date());
  const red = known && status.level === 'now';
  const canResume = known && device?.fault_code === 'no_moisture_rise';
  const { data: plant, isPending: loading } = usePlant(id);
  const species = useSpecies(plant?.species_id).data;
  const path = plant?.photo_path;
  const photo = useQuery({
    queryKey: ['photo', path],
    enabled: !!path,
    queryFn: () => signPhotoUrls([path!]).then((u) => u[path!]),
  });
  const photoUrl = photo.data;

  const go = (href: Href) => (setMenu(null), router.push(href));
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const pills = [
    ...(plant?.room ? [{ text: plant.room }] : []),
    ...(red ? [{ text: status.line, red: true }] : []),
  ];
  const kind = species?.scientific_name ? (
    <Text style={styles.italic}>{species.scientific_name}</Text>
  ) : (
    plant?.custom_type
  );
  const battery =
    device?.battery_pct == null ? '—' : `${device.battery_pct} %${device.charging ? ', charging' : ''}`;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView style={styles.screen} contentInsetAdjustmentBehavior="never" contentContainerStyle={styles.content}>
        <HeroPhoto
          uri={path ? photoUrl : undefined}
          cacheKey={path ?? undefined}
          label={`${plant?.name ?? 'Plant'} photo`}
          loading={(!plant && loading) || (!!path && !photoUrl && !photo.isError)}
          pills={pills}
          onBack={back}
          onMore={plant ? () => setMenu((m) => (m ? null : 'open')) : undefined}>
          {plant && !path ? <PotDrawing /> : null}
        </HeroPhoto>
        <View style={styles.body}>
          {plant ? (
            <FadeIn style={styles.stack}>
              <View style={styles.titles}>
                <Text variant="display" accessibilityRole="header">
                  {plant.name}
                </Text>
                {kind || plant.room ? (
                  <Text variant="subheadline" color="secondaryLabel">
                    {kind}
                    {kind && plant.room ? ', ' : null}
                    {plant.room}
                  </Text>
                ) : null}
              </View>
              {deviceQuery.isPending ? (
                <LoadingGroup>
                  <SkeletonText variant="headline" width="60%" />
                  <SkeletonRow />
                </LoadingGroup>
              ) : (
                <>
                  {known ? (
                    <View style={styles.titles}>
                      <Text testID="status-headline" variant="headline" color={red ? 'statusNow' : 'label'}>
                        {status.headline}
                      </Text>
                      <Text variant="subheadline" color="secondaryLabel">
                        {status.detail}
                      </Text>
                      {canResume && device?.resumePending ? (
                        <Text variant="subheadline">Waiting for the module…</Text>
                      ) : null}
                      {canResume && resume.isError ? (
                        <Text variant="footnote" color="statusNow" accessibilityRole="alert">
                          {"Couldn't send that. Try again."}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                  {device || deviceFailed ? (
                    <TankBar
                      // An offline module's last level isn't current ("No current reading", never a guess).
                      ml={status.key === 'offline' ? null : (device?.water_left_ml ?? null)}
                      fullMl={device?.tank_full_ml ?? SAUCER_TANK_ML}
                      low={!!device?.float_low}
                    />
                  ) : null}
                  <View style={styles.rows}>
                    {device || deviceFailed ? (
                      <>
                        <Row label="Soil" value={device ? soilLabel(device.soil_pct) : '—'} />
                        <Hairline />
                        <Row label="Battery" value={battery} />
                        <Hairline />
                        <Row label="How watering works" accessory="chevron" onPress={() => go(`/plant/${id}/watering`)} />
                      </>
                    ) : (
                      <>
                        <Row label="Set up a module" accessory="chevron" onPress={() => go(`/plant/${id}/module`)} />
                        <Hairline />
                        <Row label="Check its health" accessory="chevron" onPress={() => go(`/plant/${id}/health`)} />
                      </>
                    )}
                  </View>
                </>
              )}
              {/* shortcut: the photo strip stays until the History screen (design Phase 5) replaces it. */}
              <TimelineStrip plantId={id} />
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
      {menu && plant ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Close menu" onPress={() => setMenu(null)} style={StyleSheet.absoluteFill} />
      ) : null}
      {menu && plant ? (
        <View accessibilityViewIsModal onAccessibilityEscape={() => setMenu(null)} style={[styles.menu, { top: top + space.xs + space.touch + space.s, backgroundColor: colors.surface }]}>
          {menu === 'remove' && device ? (
            <View style={styles.confirm}>
              <Text>Remove the module? Its history is deleted. The module forgets this account at its next check-in.</Text>
              <Button
                label="Remove"
                destructive
                busy={removeModule.isPending}
                onPress={() => removeModule.mutate(device.id, { onSuccess: () => setMenu(null) })}
              />
              <Button label="Cancel" variant="plain" onPress={() => setMenu('open')} />
            </View>
          ) : menu === 'delete' ? (
            <View style={styles.confirm}>
              <Text>{`Delete ${plant.name} and all its photos?`}</Text>
              <Button
                label="Delete"
                destructive
                busy={deletePlant.isPending}
                onPress={() => deletePlant.mutate(plant.id, { onSuccess: () => router.dismissTo('/') })}
              />
              <Button label="Cancel" variant="plain" onPress={() => setMenu('open')} />
            </View>
          ) : (
            <>
              <Button label="Edit" variant="plain" onPress={() => go(`/plant/${id}/edit`)} />
              <Button label="Check its health" variant="plain" onPress={() => go(`/plant/${id}/health`)} />
              {device ? <Button label="Remove module" variant="plain" destructive onPress={() => setMenu('remove')} /> : null}
              <Button label={`Delete ${plant.name}`} variant="plain" destructive onPress={() => setMenu('delete')} />
            </>
          )}
        </View>
      ) : null}
      {canResume && device && !device.resumePending ? (
        <BottomBar>
          <Button
            label={resume.isPending ? 'Sending…' : 'Resume watering'}
            busy={resume.isPending}
            disabled={resume.isPending}
            onPress={() => resume.mutate(device.id)}
          />
        </BottomBar>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingBottom: space.xxxl },
  body: { paddingHorizontal: space.xl, paddingTop: space.l, gap: space.l },
  stack: { gap: space.xl },
  titles: { gap: space.xs },
  italic: { fontFamily: fonts.italic },
  gap: { height: space.l },
  // Rows run to the page margin: Row pads by space.l, the page by space.xl.
  rows: { marginHorizontal: -space.l },
  hairline: { height: StyleSheet.hairlineWidth, marginLeft: space.l },
  confirm: { padding: space.l, gap: space.s, maxWidth: 280 },
  menu: { position: 'absolute', right: space.xl, borderRadius: radius.group, zIndex: 1 },
});
