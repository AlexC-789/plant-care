import { Stack, useRouter } from 'expo-router';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import type { Light } from '@/plants/api';
import { nameField, plantName, useAddDraft } from '@/plants/addDraft';
import { deletePhotos } from '@/plants/photos';
import { useCreatePlant, usePlants } from '@/plants/queries';
import { radius, space, typography, useTheme } from '@/theme';
import { BottomBar, Button, StepDone, StepProgress, Text, TextLink } from '@/ui';

const SUCCESS_MS = 700;
const USUAL_ROOMS = ['Living room', 'Bedroom', 'Kitchen', 'Hall'];
const LIGHTS: { value: Light; title: string; hint: string }[] = [
  { value: 'bright_indirect', title: 'Bright', hint: 'Near a sunny window' },
  { value: 'medium', title: 'Medium', hint: 'A few steps away' },
  { value: 'low', title: 'Low', hint: 'Far from windows' },
];

/** A pill (rooms) or a box (light) that is picked, not typed. */
function Choice({ label, selected, onPress, box, children }: { label: string; selected: boolean; onPress: () => void; box?: boolean; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={box ? undefined : 2}
      style={({ pressed }) => [
        box ? styles.box : styles.chip,
        box
          ? { backgroundColor: colors.surface, borderColor: selected ? colors.tint : colors.waterFill, borderWidth: selected ? 2 : 1 }
          : { backgroundColor: selected ? colors.tint : colors.surface, borderColor: colors.waterFill, borderWidth: selected ? 0 : 1 },
        pressed && styles.pressed,
      ]}>
      {children}
    </Pressable>
  );
}

/** Step 2 of 3: name, room and light. "Save {name}" creates the plant, once. */
export default function WhereStep() {
  const router = useRouter();
  const { colors } = useTheme();
  const { draft, set } = useAddDraft();
  const create = useCreatePlant();
  const plants = usePlants();
  const [saveFailed, setSaveFailed] = useState(false);
  // Guards a second tap before the first re-render disables the button.
  const saving = useRef(false);

  const name = plantName(draft);
  const room = draft.room.trim();
  // The person's own rooms first, then the usual ones (case-insensitive, no repeats).
  const rooms = [...(plants.data?.pages.flatMap((p) => p.plants.map((x) => x.room?.trim())) ?? []), ...USUAL_ROOMS]
    .filter((r): r is string => !!r)
    .filter((r, i, all) => all.findIndex((x) => x.toLowerCase() === r.toLowerCase()) === i);
  const [other, setOther] = useState(() => !!room && !rooms.includes(room));
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
        light: draft.light,
        speciesId: species && 'id' in species ? species.id : undefined,
        customType: species && 'custom' in species ? species.custom : undefined,
        photoPath: draft.capture?.path,
        scanId: draft.scanId,
      });
      set({ plantId: plant.id });
    } catch {
      saving.current = false;
      setSaveFailed(true);
    }
  }

  const cancel = () => {
    if (draft.capture) void deletePhotos([draft.capture.path]).catch(() => {});
    router.dismissTo('/');
  };

  const pickRoom = (r: string) => {
    setOther(false);
    set({ room: room === r ? '' : r });
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ headerRight: saved || create.isPending ? undefined : () => <TextLink label="Cancel" onPress={cancel} /> }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={styles.content}>
        <StepProgress step={2} total={3} />
        {saved ? (
          <StepDone title={room ? `${name} is in the ${room}.` : `${name} is saved.`} />
        ) : (
          <>
            <Text variant="largeTitle" accessibilityRole="header">
              Name and place
            </Text>
            <View style={styles.field}>
              <Text variant="subheadline" color="secondaryLabel">
                Name
              </Text>
              <TextInput
                accessibilityLabel="Name"
                style={[styles.input, typography.body, { color: colors.label, backgroundColor: colors.surface }]}
                value={nameField(draft)}
                onChangeText={(t) => set({ nickname: t })}
                selectTextOnFocus
                autoFocus={!name}
                maxLength={40}
              />
              {name ? null : (
                <Text variant="footnote" color="statusNow" accessibilityRole="alert">
                  Give it a name.
                </Text>
              )}
            </View>
            <View style={styles.field}>
              <Text variant="subheadline" color="secondaryLabel" accessibilityRole="header">
                Room
              </Text>
              <View style={styles.chips}>
                {rooms.map((r) => (
                  <Choice key={r} label={r} selected={!other && room === r} onPress={() => pickRoom(r)}>
                    <Text variant="subheadline" color={!other && room === r ? 'onTint' : 'label'}>
                      {r}
                    </Text>
                  </Choice>
                ))}
                <Choice
                  label="Other…"
                  selected={other}
                  onPress={() => {
                    setOther(!other);
                    set({ room: '' });
                  }}>
                  <Text variant="subheadline" color={other ? 'onTint' : 'label'}>
                    Other…
                  </Text>
                </Choice>
              </View>
              {other ? (
                <TextInput
                  accessibilityLabel="Room"
                  style={[styles.input, typography.body, { color: colors.label, backgroundColor: colors.surface }]}
                  value={draft.room}
                  onChangeText={(t) => set({ room: t })}
                  autoFocus
                  maxLength={40}
                />
              ) : null}
            </View>
            <View style={styles.field}>
              <Text variant="subheadline" color="secondaryLabel" accessibilityRole="header">
                Light where it stands
              </Text>
              <View style={styles.lights}>
                {LIGHTS.map((l) => (
                  <Choice key={l.value} box label={`${l.title}, ${l.hint.toLowerCase()}`} selected={draft.light === l.value} onPress={() => set({ light: l.value })}>
                    <Text variant="headline">{l.title}</Text>
                    <Text variant="footnote" color="secondaryLabel">
                      {l.hint}
                    </Text>
                  </Choice>
                ))}
              </View>
            </View>
            {saveFailed ? (
              <Text variant="footnote" color="statusNow" accessibilityRole="alert">
                {`Couldn't save ${name}. Try again.`}
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>
      <BottomBar>
        <Button
          label={name ? `Save ${name}` : 'Save'}
          busy={create.isPending}
          disabled={!name || create.isPending || saved}
          onPress={() => void save()}
        />
      </BottomBar>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: space.xl, gap: space.xl },
  field: { gap: space.s },
  input: { minHeight: space.touch, paddingHorizontal: space.l, borderRadius: radius.thumb },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  chip: { minHeight: 40, paddingHorizontal: space.m + 2, borderRadius: radius.capsule, justifyContent: 'center' },
  lights: { flexDirection: 'row', gap: space.s },
  box: { flex: 1, padding: space.m, borderRadius: radius.thumb, gap: space.xs },
  pressed: { transform: [{ scale: 0.97 }] },
});
