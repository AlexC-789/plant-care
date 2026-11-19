import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput } from 'react-native';

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
  // Guards a second tap before the first re-render disables the button.
  const saving = useRef(false);

  const type = typeName(draft);
  const name = plantName(draft);
  const room = draft.room.trim();
  // Also true when the user comes back to this step after a save: show the success and move on.
  const saved = !!draft.plantId;

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => router.replace('/add/health'), SUCCESS_MS);
    return () => clearTimeout(t);
  }, [saved, router]);

  async function save() {
    if (!name || saving.current || saved) return;
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
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ headerRight: saved || create.isPending ? undefined : () => <TextLink label="Cancel" onPress={cancel} /> }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={styles.content}>
        <StepProgress step={3} />
        {saved ? (
          <StepDone title={room ? `${name} is in the ${room}.` : `${name} is saved.`} />
        ) : (
          <>
            <Text variant="largeTitle" accessibilityRole="header">
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
              <Row label={type ? 'Nickname' : 'Name'}>
                <TextInput
                  accessibilityLabel={type ? 'Nickname' : 'Name'}
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
        <Button label="Continue" busy={create.isPending} disabled={!name || create.isPending || saved} onPress={() => void save()} />
      </BottomBar>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: space.l, gap: space.l },
  // Same box as a Row's plain text: the Row supplies the height and padding.
  input: { flex: 1, textAlign: 'right', padding: 0 },
});
