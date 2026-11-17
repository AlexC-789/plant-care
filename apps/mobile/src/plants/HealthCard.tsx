import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { HealthResult, Scan } from '@/plants/api';
import { radius, space, useTheme } from '@/theme';
import { Button, Text } from '@/ui';

/** Latest health result (if any) and the button that starts a new check. */
export function HealthCard({ plantId, latest }: { plantId: string; latest?: Scan | null }) {
  const router = useRouter();
  const { colors } = useTheme();
  const result = latest?.health as HealthResult | null | undefined;
  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <Text variant="headline" accessibilityRole="header">
        Health
      </Text>
      {latest && result ? (
        <>
          <Text variant="subheadline">
            {`Checked ${new Date(latest.created_at).toLocaleDateString()}: ${result.note}`}
          </Text>
          {result.advice ? <Text variant="subheadline">{result.advice}</Text> : null}
        </>
      ) : null}
      <Button label="Check its health" variant="bordered" onPress={() => router.push(`/plant/${plantId}/health`)} />
    </View>
  );
}

const styles = StyleSheet.create({ card: { borderRadius: radius.group, padding: space.l, gap: space.s } });
