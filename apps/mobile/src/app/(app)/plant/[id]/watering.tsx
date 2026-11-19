import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { usePlant } from '@/plants/queries';
import { space } from '@/theme';
import { Text } from '@/ui';

/**
 * "How watering works" sheet (SCREEN_SPECIFICATIONS §12). The numbers mirror LIMITS in
 * supabase/functions/_shared/watering.ts (40 ml a dose, 150 ml in 24 h); change both together.
 */
export default function HowWateringWorks() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const name = usePlant(id).data?.name ?? 'Your plant';
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Text>{`${name} gets at most 40 ml at a time and 150 ml a day.`}</Text>
      <Text>It never pumps when the tank is low.</Text>
      <Text>{"If two drinks don't make the soil wetter, it stops and asks you to check the stake."}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: space.xl, gap: space.l } });
