import { Image } from 'expo-image';
import { Stack, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { useAddDraft } from '@/plants/addDraft';
import { deletePhotos } from '@/plants/photos';
import { useCreatePlant, useIdentify } from '@/plants/queries';
import { Suggestions } from '@/plants/Suggestions';
import { radius, space, typography, useTheme } from '@/theme';
import { Button, InsetGroup, Row, Text } from '@/ui';

const COULDNT = "Couldn't tell from this photo. Try one with a whole leaf in view, or search.";
// The server's own message for a 429; any other failure reads as "couldn't tell".
const LIMIT = "You've reached the identification limit for now. Search for the plant type, or try again later.";

export default function PlantStep() {
  const router = useRouter();
  const { colors } = useTheme();
  const { draft, set } = useAddDraft();
  const identify = useIdentify();
  const create = useCreatePlant();
  const [message, setMessage] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  const whole = draft.photos.find((p) => p.kind === 'whole');
  const typeName = !draft.species ? '' : 'custom' in draft.species ? draft.species.custom : draft.species.name;
  const name = draft.name.trim();

  const runIdentify = () => {
    setMessage(null);
    identify.mutate(
      draft.photos.map((p) => p.path),
      {
        onSuccess: (r) => {
          if (r.isPlant && r.suggestions.length) set({ scanId: r.scanId, suggestions: r.suggestions.slice(0, 3) });
          else setMessage(COULDNT);
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
      // Leaf and flower photos only live on as part of an identify scan.
      if (!draft.scanId) {
        const extra = draft.photos.filter((p) => p.kind !== 'whole').map((p) => p.path);
        void deletePhotos(extra).catch(() => {});
      }
      router.back();
      // shortcut: `as Href` until Task 11 adds the plant route (typed routes), then drop the cast.
      router.push(`/plant/${plant.id}` as Href);
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
      <Stack.Screen options={{ headerRight: () => <Button label="Cancel" variant="plain" onPress={cancel} /> }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}>
        <Text variant="title" accessibilityRole="header">
          Which plant is this for?
        </Text>

        <InsetGroup>
          <Row label="Add photo" accessory="chevron" onPress={() => router.push('/add/capture')} />
          <Row label="Name">
            <TextInput
              accessibilityLabel="Name"
              placeholder="Name"
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

        {draft.photos.length ? (
          <View style={styles.photos}>
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
          </View>
        ) : null}

        {draft.suggestions?.length ? (
          <Suggestions
            suggestions={draft.suggestions}
            onSearch={() => router.push('/add/search')}
            onUse={(s) =>
              set({
                species: { id: s.speciesId, name: s.commonName },
                name: draft.name.trim() ? draft.name : s.commonName,
                suggestions: undefined,
              })
            }
          />
        ) : whole && !draft.scanId ? (
          <Button label="Identify" variant="bordered" busy={identify.isPending} disabled={identify.isPending} onPress={runIdentify} />
        ) : null}
        {message ? (
          <Text variant="footnote" color="statusNow" accessibilityRole="alert">
            {message}
          </Text>
        ) : null}

        <Text variant="footnote" color="secondaryLabel">
          {"Not sure what it is? Add a photo and we'll suggest a type. The type sets how damp the soil should stay."}
        </Text>
        {saveFailed ? (
          <Text variant="footnote" color="statusNow" accessibilityRole="alert">
            {"Couldn't save your plant. Try again."}
          </Text>
        ) : null}
        <Button label="Continue" busy={create.isPending} disabled={!name || create.isPending} onPress={() => void save()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: space.l, gap: space.l, paddingBottom: space.xxxl },
  input: { flex: 1, textAlign: 'right', minHeight: space.touch },
  photos: { flexDirection: 'row', gap: space.s },
  photoBox: { borderRadius: radius.thumb, overflow: 'hidden' },
  photo: { width: 80, height: 80 },
  overlay: { ...StyleSheet.absoluteFill, opacity: 0.85, alignItems: 'center', justifyContent: 'center', padding: space.xs },
});
