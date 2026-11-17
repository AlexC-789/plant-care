import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import type { Species } from '@/plants/addDraft';
import type { Plant } from '@/plants/api';
import { CaptureCards, type Photo } from '@/plants/CaptureCards';
import { deletePhotos, signPhotoUrls } from '@/plants/photos';
import { useDeletePlant, usePlant, useSpecies, useUpdatePlant } from '@/plants/queries';
import { TypeSearch } from '@/plants/TypeSearch';
import { radius, space, typography, useTheme } from '@/theme';
import { Button, InsetGroup, LoadingGroup, Row, SkeletonRow, Text } from '@/ui';

const WHOLE = [{ kind: 'whole', title: 'Whole plant', hint: 'Step back so the whole plant and pot fit' }];

function EditForm({ plant }: { plant: Plant }) {
  const router = useRouter();
  const { colors } = useTheme();
  const update = useUpdatePlant();
  const remove = useDeletePlant();
  const current = useSpecies(plant.species_id).data;
  const [name, setName] = useState(plant.name);
  const [room, setRoom] = useState(plant.room ?? '');
  const [species, setSpecies] = useState<Species | undefined>();
  const [picking, setPicking] = useState(false);
  const [fresh, setFresh] = useState<Photo[]>([]);
  const [removed, setRemoved] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const oldPath = plant.photo_path;
  const photoUrl = useQuery({
    queryKey: ['photo', oldPath],
    enabled: !!oldPath,
    queryFn: () => signPhotoUrls([oldPath!]).then((u) => u[oldPath!]),
  }).data;

  // A replacement uploaded but never saved is deleted when the sheet goes away.
  const unsaved = useRef<string | undefined>(undefined);
  useEffect(() => {
    unsaved.current = fresh[0]?.path;
  }, [fresh]);
  useEffect(() => () => void (unsaved.current && deletePhotos([unsaved.current]).catch(() => {})), []);

  const typeName = !species
    ? (current?.common_names[0] ?? current?.scientific_name ?? plant.custom_type ?? '')
    : 'custom' in species
      ? species.custom
      : species.name;

  async function save() {
    const trimmed = name.trim();
    setInvalid(!trimmed);
    if (!trimmed) return;
    setFailed(false);
    const photo_path = fresh[0]?.path ?? (removed ? null : undefined);
    // Once the save starts the row may point at the new photo: closing the sheet must not delete it.
    unsaved.current = undefined;
    try {
      await update.mutateAsync({
        id: plant.id,
        patch: {
          name: trimmed,
          room: room.trim() || null,
          ...(species && { species_id: 'id' in species ? species.id : null, custom_type: 'custom' in species ? species.custom : null }),
          ...(photo_path !== undefined && { photo_path }),
        },
      });
    } catch {
      unsaved.current = fresh[0]?.path;
      return setFailed(true);
    }
    // The row no longer points at the old object, so it is safe to delete.
    if (photo_path !== undefined && oldPath) void deletePhotos([oldPath]).catch(() => {});
    router.back();
  }

  // The header button is rendered by the navigator: keep it pointing at the latest closure.
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });

  async function doDelete() {
    try {
      await remove.mutateAsync(plant.id);
      router.dismissTo('/');
    } catch {
      setFailed(true);
    }
  }

  if (picking) {
    return (
      <TypeSearch
        onPick={(s) => {
          setSpecies(s);
          setPicking(false);
        }}
      />
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          headerRight: () => <Button label="Done" variant="plain" busy={update.isPending} onPress={() => void saveRef.current()} />,
        }}
      />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {oldPath && !removed && !fresh.length ? (
          <View style={styles.stack}>
            {photoUrl ? (
              <Image accessibilityLabel={`${plant.name} photo`} source={{ uri: photoUrl, cacheKey: oldPath }} style={styles.thumb} />
            ) : null}
            <Button label="Remove current photo" variant="plain" destructive onPress={() => setRemoved(true)} />
          </View>
        ) : null}
        <CaptureCards cards={WHOLE} photos={fresh} onChange={setFresh} />

        <InsetGroup>
          <Row label="Name">
            <TextInput
              accessibilityLabel="Name"
              placeholder="Name"
              placeholderTextColor={colors.secondaryLabel}
              style={[styles.input, typography.body, { color: colors.label }]}
              value={name}
              onChangeText={setName}
              maxLength={60}
            />
          </Row>
          <Row label="Plant type" value={typeName || 'Choose'} accessory="chevron" onPress={() => setPicking(true)} />
          <Row label="Room">
            <TextInput
              accessibilityLabel="Room"
              placeholder="Optional"
              placeholderTextColor={colors.secondaryLabel}
              style={[styles.input, typography.body, { color: colors.label }]}
              value={room}
              onChangeText={setRoom}
              maxLength={40}
            />
          </Row>
        </InsetGroup>
        {invalid ? (
          <Text variant="footnote" color="statusNow" accessibilityRole="alert">
            Give it a name (up to 60 characters).
          </Text>
        ) : null}
        {failed ? (
          <Text variant="footnote" color="statusNow" accessibilityRole="alert">
            {"Couldn't save that. Try again."}
          </Text>
        ) : null}

        {confirming ? (
          <View style={styles.stack}>
            <Text>{`Delete ${plant.name}? Its photos are deleted too. This can't be undone.`}</Text>
            <Button label="Delete" destructive busy={remove.isPending} onPress={() => void doDelete()} />
            <Button label="Cancel" variant="plain" onPress={() => setConfirming(false)} />
          </View>
        ) : (
          <Button label="Delete plant" variant="plain" destructive onPress={() => setConfirming(true)} />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default function EditPlant() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: plant } = usePlant(id);
  return plant ? (
    <EditForm plant={plant} />
  ) : (
    <View style={styles.content}>
      <LoadingGroup>
        <SkeletonRow />
        <SkeletonRow />
      </LoadingGroup>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: space.l, gap: space.l, paddingBottom: space.xxxl },
  stack: { gap: space.s },
  thumb: { height: 160, borderRadius: radius.thumb },
  input: { flex: 1, textAlign: 'right', minHeight: space.touch },
});
