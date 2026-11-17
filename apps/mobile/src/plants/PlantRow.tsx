import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Plant } from '@/plants/api';
import { radius, space, useTheme } from '@/theme';
import { Icon, PotDrawing, Text } from '@/ui';

const PHOTO = 60;

/** One plant on Home. In M2 every plant is still waiting for its module. */
export function PlantRow({
  plant,
  photoUrl,
  onPress,
}: {
  plant: Plant;
  photoUrl?: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const status = "Setup isn't finished · Add its module";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${plant.name}, ${status}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.surface },
        pressed && styles.pressed,
      ]}>
      {photoUrl && plant.photo_path ? (
        <Image source={{ uri: photoUrl, cacheKey: plant.photo_path }} style={styles.photo} />
      ) : (
        <View style={styles.photo}>
          <PotDrawing width={PHOTO} />
        </View>
      )}
      <View style={styles.text}>
        <Text variant="title3">{plant.name}</Text>
        <View style={styles.status}>
          <Icon name="quiet" size={8} color="statusQuiet" />
          <Text variant="subheadline" style={styles.statusText}>
            {status}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    padding: space.m,
    borderRadius: radius.group,
  },
  pressed: { opacity: 0.6 },
  photo: {
    width: PHOTO,
    height: PHOTO,
    borderRadius: radius.thumb,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: space.xs },
  status: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  statusText: { flex: 1 },
});
