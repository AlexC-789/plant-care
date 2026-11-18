import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useAddDraft } from '@/plants/addDraft';
import { ADD_CARDS, CaptureCards } from '@/plants/CaptureCards';
import { deletePhotos } from '@/plants/photos';
import { radius, space } from '@/theme';
import { BottomBar, Button, StepDone, StepProgress, Text, TextLink } from '@/ui';

/** Step 1 of 4: photos. The whole-plant photo is required. */
export default function PhotoStep() {
  const router = useRouter();
  const { draft, set } = useAddDraft();
  const whole = draft.photos.find((p) => p.kind === 'whole');

  const cancel = () => {
    void deletePhotos(draft.photos.map((p) => p.path)).catch(() => {});
    router.back();
  };

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ headerRight: () => <TextLink label="Cancel" onPress={cancel} /> }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <StepProgress step={1} />
        <Text variant="title" accessibilityRole="header">
          Take a photo of your plant
        </Text>
        {whole ? (
          <StepDone title="Got it.">
            <Image accessibilityLabel="Your plant" source={{ uri: whole.localUri }} style={styles.hero} />
          </StepDone>
        ) : null}
        <CaptureCards
          cards={ADD_CARDS}
          photos={draft.photos}
          // New photos make an earlier identification stale: step 2 starts fresh.
          onChange={(photos) => set({ photos, scanId: undefined, suggestions: undefined, species: undefined })}
        />
      </ScrollView>
      <BottomBar>
        <Button label="Continue" disabled={!whole} onPress={() => router.push('/add/identify')} />
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: space.l, gap: space.l },
  hero: { width: 280, aspectRatio: 1, borderRadius: radius.group },
});
