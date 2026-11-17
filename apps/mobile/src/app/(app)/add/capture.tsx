import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useAddDraft } from '@/plants/addDraft';
import { ADD_CARDS, CaptureCards } from '@/plants/CaptureCards';
import { space } from '@/theme';
import { BottomBar, Button } from '@/ui';

export default function Capture() {
  const router = useRouter();
  const { draft, set } = useAddDraft();
  return (
    <View style={styles.flex}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <CaptureCards
          cards={ADD_CARDS}
          photos={draft.photos}
          // New photos make an earlier identification stale.
          onChange={(photos) => set({ photos, scanId: undefined, suggestions: undefined })}
        />
      </ScrollView>
      <BottomBar>
        <Button label="Done" onPress={() => router.back()} />
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: space.l, gap: space.l },
});
