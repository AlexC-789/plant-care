import { Stack, useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { plantName, typeName, useAddDraft } from '@/plants/addDraft';
import { deletePhotos } from '@/plants/photos';
import { useCreatePlant } from '@/plants/queries';
import { space, typography, useTheme } from '@/theme';
import { BottomBar, Button, InsetGroup, Row, StepDone, StepProgress, Text, TextLink } from '@/ui';

const SUCCESS_MS = 700;

/** Step 3 of 4: where it lives. Continue saves the plant, once. */
export default function WhereStep() {
  const router = useRouter();
  const { colors } = useTheme();
  const { draft, set } = useAddDraft();
  const create = useCreatePlant();
  const [saveFailed, setSaveFailed] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  // Guards a second tap before the first re-render disables the button.
  const saving = useRef(false);

  const type = typeName(draft);
  const name = plantName(draft);
  const room = draft.room.trim();

  useEffect(() => {
    if (!done) return;
    // shortcut: /add/health is created in Task 5; drop the cast then.
    const t = setTimeout(() => router.replace('/add/health' as Href), SUCCESS_MS);
    return () => clearTimeout(t);
  }, [done, router]);

  async function save() {
    if (!name || saving.current || draft.plantId) return;
    saving.current = true;
    setSaveFailed(false);
    try {
      const species = draft.species;
      const plant = await create.mutateAsync({
        name,
        room: room || undefined,
        speciesId: species && 'id' in species ? species.id : undefined,
        customType: species && 'custom' in species ? species.custom : undefined,
        photoPath: draft.photos.find((p) => p.kind === 'whole')?.path,
        scanId: draft.scanId,
      });
      set({ plantId: plant.id });
      // Leaf and flower photos only live on as part of an identify scan; the problem photo waits for step 4.
      const gone = draft.photos.filter((p) => (p.kind === 'leaf' || p.kind === 'flower') && !draft.scanId);
      if (gone.length) void deletePhotos(gone.map((p) => p.path)).catch(() => {});
      setDone(room ? `${name} is in the ${room}.` : `${name} is saved.`);
    } catch {
      saving.current = false;
      setSaveFailed(true);
    }
  }

  const cancel = () => {
    void deletePhotos(draft.photos.map((p) => p.path)).catch(() => {});
    router.dismissTo('/');
  };

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ headerRight: done ? undefined : () => <TextLink label="Cancel" onPress={cancel} /> }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={styles.content}>
        <StepProgress step={3} />
        {done ? (
          <StepDone title={done} />
        ) : (
          <>
            <Text variant="title" accessibilityRole="header">
              Where does it live?
            </Text>
            <InsetGroup>
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
              <Row label="Nickname">
                <TextInput
                  accessibilityLabel="Nickname"
                  placeholder={type ?? 'Required'}
                  placeholderTextColor={colors.secondaryLabel}
                  style={[styles.input, typography.body, { color: colors.label }]}
                  value={draft.nickname}
                  onChangeText={(t) => set({ nickname: t })}
                  maxLength={60}
                />
              </Row>
            </InsetGroup>
            {saveFailed ? (
              <Text variant="footnote" color="statusNow" accessibilityRole="alert">
                {"Couldn't save your plant. Try again."}
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>
      <BottomBar>
        <Button label="Continue" busy={create.isPending} disabled={!name || create.isPending || !!done} onPress={() => void save()} />
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: space.l, gap: space.l },
  // Same box as a Row's plain text: the Row supplies the height and padding.
  input: { flex: 1, textAlign: 'right', padding: 0 },
});
