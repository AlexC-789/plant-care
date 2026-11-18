import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { useAddDraft } from '@/plants/addDraft';
import { deletePhotos } from '@/plants/photos';
import { useCheckHealth, useCreatePlant, useIdentify } from '@/plants/queries';
import { Suggestions } from '@/plants/Suggestions';
import { radius, space, typography, useTheme } from '@/theme';
import { BottomBar, Button, Icon, InsetGroup, Row, Text, TextLink } from '@/ui';

const COULDNT = "Couldn't tell from this photo. Try one with a whole leaf in view, or search.";
// The server's own message for a 429; any other failure reads as "couldn't tell".
const LIMIT = "You've reached the identification limit for now. Search for the plant type, or try again later.";

export default function PlantStep() {
  const router = useRouter();
  const { colors } = useTheme();
  const { draft, set } = useAddDraft();
  // apply runs after an async identify, so it must read the latest draft, not the one from the tap.
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  });
  const identify = useIdentify();
  const create = useCreatePlant();
  const check = useCheckHealth();
  const [message, setMessage] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  const whole = draft.photos.find((p) => p.kind === 'whole');
  const typeName = !draft.species ? '' : 'custom' in draft.species ? draft.species.custom : draft.species.name;
  const name = draft.name.trim();

  // Applies a suggestion: sets the type; Name follows only while it is empty or still the previous suggestion's name.
  const apply = (s: { speciesId: string; commonName: string }) => {
    const d = draftRef.current;
    const prev = d.species && 'id' in d.species ? d.species.name : '';
    set({
      species: { id: s.speciesId, name: s.commonName },
      name: !d.name.trim() || d.name === prev ? s.commonName : d.name,
    });
  };

  const runIdentify = () => {
    setMessage(null);
    identify.mutate(
      // The problem photo is for the health check only; identify takes whole, leaf and flower.
      draft.photos.filter((p) => p.kind !== 'problem').map((p) => p.path),
      {
        onSuccess: (r) => {
          if (r.isPlant && r.suggestions.length) {
            set({ scanId: r.scanId, suggestions: r.suggestions.slice(0, 3) });
            if (r.suggestions[0].confidence === 'very_likely') apply(r.suggestions[0]);
          } else setMessage(COULDNT);
        },
        onError: (e) => setMessage(e.message === LIMIT ? LIMIT : COULDNT),
      },
    );
  };

  async function save() {
    setSaveFailed(false);
    try {
      const species = draft.species;
      const plant = await create.mutateAsync({
        name,
        room: draft.room.trim() || undefined,
        speciesId: species && 'id' in species ? species.id : undefined,
        customType: species && 'custom' in species ? species.custom : undefined,
        photoPath: whole?.path,
        scanId: draft.scanId,
      });
      // A problem-spot photo starts a health check (not awaited; the detail shows its progress) and lives on as that scan.
      const spot = draft.photos.find((p) => p.kind === 'problem');
      const checking = !!(whole && spot);
      if (checking) check.mutate({ plantId: plant.id, photoPaths: [whole.path, spot.path] });
      // Leaf and flower photos only live on as part of an identify scan; an unused problem photo is deleted too.
      const gone = draft.photos.filter((p) => (p.kind === 'leaf' || p.kind === 'flower') && !draft.scanId || (p.kind === 'problem' && !checking));
      if (gone.length) void deletePhotos(gone.map((p) => p.path)).catch(() => {});
      router.back();
      router.push(`/plant/${plant.id}`);
    } catch {
      setSaveFailed(true);
    }
  }

  const cancel = () => {
    void deletePhotos(draft.photos.map((p) => p.path)).catch(() => {});
    router.back();
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ headerRight: () => <TextLink label="Cancel" onPress={cancel} /> }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text variant="title" accessibilityRole="header">
            Which plant is this for?
          </Text>
          {draft.photos.length ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit photos"
              onPress={() => router.push('/add/capture')}
              style={styles.photos}>
              {draft.photos.map((p, i) => (
                <View key={p.path} style={styles.photoBox}>
                  <Image source={{ uri: p.localUri }} style={styles.photo} />
                  {i === 0 && identify.isPending ? (
                    <View style={[styles.overlay, { backgroundColor: colors.background }]}>
                      <Text variant="footnote" accessibilityLiveRegion="polite">
                        Looking at your photo…
                      </Text>
                    </View>
                  ) : null}
                </View>
              ))}
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add photos"
              onPress={() => router.push('/add/capture')}
              style={[styles.tile, { backgroundColor: colors.surface }]}>
              <Icon name="camera" size={28} color="tint" />
              <Text variant="headline" color="tint">
                Add photos
              </Text>
            </Pressable>
          )}
          {whole && !draft.scanId && !draft.suggestions?.length ? (
            <Button label="Identify" variant="bordered" busy={identify.isPending} disabled={identify.isPending} onPress={runIdentify} />
          ) : null}
          {draft.suggestions?.length ? (
            <Suggestions
              suggestions={draft.suggestions}
              onSearch={() => router.push('/add/search')}
              onPick={apply}
            />
          ) : null}
          {message ? (
            <Text variant="footnote" color="statusNow" accessibilityRole="alert">
              {message}
            </Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <InsetGroup>
            <Row label="Name">
              <TextInput
                accessibilityLabel="Name"
                placeholder="Required"
                placeholderTextColor={colors.secondaryLabel}
                style={[styles.input, typography.body, { color: colors.label }]}
                value={draft.name}
                onChangeText={(t) => set({ name: t })}
                maxLength={60}
              />
            </Row>
            <Row
              label="Plant type"
              value={typeName || 'Choose'}
              accessory="chevron"
              onPress={() => router.push('/add/search')}
            />
            <Row label="Room">
              <TextInput
                accessibilityLabel="Room"
                placeholder="Optional"
                placeholderTextColor={colors.secondaryLabel}
                style={[styles.input, typography.body, { color: colors.label }]}
                value={draft.room}
                onChangeText={(t) => set({ room: t })}
                maxLength={40}
              />
            </Row>
          </InsetGroup>
          <Text variant="footnote" color="secondaryLabel" style={styles.hint}>
            {"Not sure what it is? Add a photo and we'll suggest a type. The type sets how damp the soil should stay."}
          </Text>
          {saveFailed ? (
            <Text variant="footnote" color="statusNow" accessibilityRole="alert">
              {"Couldn't save your plant. Try again."}
            </Text>
          ) : null}
        </View>
      </ScrollView>
      <BottomBar>
        <Button label="Continue" busy={create.isPending} disabled={!name || create.isPending} onPress={() => void save()} />
      </BottomBar>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: space.l, gap: space.xl },
  section: { gap: space.s },
  tile: { aspectRatio: 16 / 9, borderRadius: radius.group, alignItems: 'center', justifyContent: 'center', gap: space.s },
  // Same box as a Row's plain text: the Row supplies the height and padding.
  input: { flex: 1, textAlign: 'right', padding: 0 },
  hint: { marginHorizontal: space.l },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  photoBox: { borderRadius: radius.thumb, overflow: 'hidden' },
  photo: { width: 80, height: 80 },
  overlay: { ...StyleSheet.absoluteFill, opacity: 0.85, alignItems: 'center', justifyContent: 'center', padding: space.xs },
});
