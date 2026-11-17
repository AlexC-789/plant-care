import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { useAddDraft } from '@/plants/addDraft';
import { ADD_CARDS, CaptureCards } from '@/plants/CaptureCards';
import { space } from '@/theme';
import { Button } from '@/ui';

export default function Capture() {
  const router = useRouter();
  const { draft, set } = useAddDraft();
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <CaptureCards
        cards={ADD_CARDS}
        photos={draft.photos}
        // New photos make an earlier identification stale.
        onChange={(photos) => set({ photos, scanId: undefined, suggestions: undefined })}
      />
      <Button label="Done" onPress={() => router.back()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: space.l, gap: space.l, paddingBottom: space.xxxl } });
