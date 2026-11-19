import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Status } from '@/devices/status';
import type { PlantWithDevice } from '@/plants/api';
import { space, useTheme } from '@/theme';
import { PotDrawing, tankWords, Text, WaterLine } from '@/ui';

type Props = { plant: PlantWithDevice; photoUrl?: string; status: Status; onPress: () => void };

// An offline module's last level isn't current: show none rather than a guess.
const tankMl = (p: PlantWithDevice, s: Status) => (s.key === 'offline' ? null : (p.device?.water_left_ml ?? null));

/** Row label: the water line is hidden from screen readers, so its level goes into words here. */
const label = (p: PlantWithDevice, s: Status) =>
  [p.name, s.line, p.device && `tank ${tankWords(tankMl(p, s), !!p.device.float_low).toLowerCase()}`].filter(Boolean).join(', ');

/** "{type}, {room}", leaving out whatever is missing. */
export const plantSubhead = (p: PlantWithDevice) =>
  [p.species?.common_names[0] ?? p.custom_type, p.room].filter(Boolean).join(', ');

function Photo({ plant, photoUrl, status, row }: Pick<Props, 'plant' | 'photoUrl' | 'status'> & { row?: boolean }) {
  const { colors } = useTheme();
  const d = plant.device;
  const ml = tankMl(plant, status);
  return (
    <View style={[styles.photoStack, row ? styles.rowStack : styles.tileStack]}>
      <View style={[row ? styles.rowPhoto : styles.tilePhoto, styles.photo, { backgroundColor: colors.surface }]}>
        {photoUrl && plant.photo_path ? (
          <Image source={{ uri: photoUrl, cacheKey: plant.photo_path }} contentFit="cover" style={StyleSheet.absoluteFill} />
        ) : (
          <PotDrawing width={64} />
        )}
      </View>
      {d ? (
        <WaterLine level={ml === null ? null : ml / d.tank_full_ml} low={!!d.float_low} />
      ) : null}
    </View>
  );
}

/** A plant under "need you": photo with its water line, name, "{type}, {room}" and the status sentence. */
export function PlantRow({ plant, photoUrl, status, onPress }: Props) {
  const subhead = plantSubhead(plant);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label(plant, status)}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <Photo plant={plant} photoUrl={photoUrl} status={status} row />
      <View style={styles.text}>
        <Text variant="title">{plant.name}</Text>
        {subhead ? (
          <Text variant="subheadline" color="secondaryLabel">
            {subhead}
          </Text>
        ) : null}
        <Text variant="subheadline" color={status.level === 'now' ? 'statusNow' : 'label'}>
          {status.line}
        </Text>
      </View>
    </Pressable>
  );
}

/** A plant under "doing well": a grid tile with photo, water line, name and its status in secondary. */
export function PlantTile({ plant, photoUrl, status, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label(plant, status)}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
      <Photo plant={plant} photoUrl={photoUrl} status={status} />
      <Text variant="title">{plant.name}</Text>
      <Text variant="subheadline" color="secondaryLabel">
        {status.line}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.l, alignItems: 'flex-start' },
  tile: { flex: 1, gap: space.xs },
  photoStack: { gap: space.xs },
  photo: { borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  rowStack: { width: 96 },
  tileStack: { width: '100%' },
  rowPhoto: { height: 112 },
  tilePhoto: { aspectRatio: 96 / 112 },
  text: { flex: 1, gap: space.xs, paddingTop: space.xs },
  pressed: { transform: [{ scale: 0.97 }] },
});
