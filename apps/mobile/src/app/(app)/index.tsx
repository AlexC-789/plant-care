import { ScrollView, StyleSheet, View } from 'react-native';

import { space } from '@/theme';
import { PotDrawing, Text } from '@/ui';

export default function Plants() {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.container}>
      <View style={styles.empty}>
        <PotDrawing />
        <Text variant="title3" accessibilityRole="header" style={styles.center}>
          No plants yet
        </Text>
        <Text variant="subheadline" color="secondaryLabel" style={styles.center}>
          Adding pots arrives in the next build.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: space.l },
  empty: { alignItems: 'center', gap: space.s, paddingBottom: space.xxxl * 2 },
  center: { textAlign: 'center' },
});
