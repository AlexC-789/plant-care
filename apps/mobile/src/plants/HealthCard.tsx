import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { HealthResult, Scan } from '@/plants/api';
import { useHealthCheckStatus } from '@/plants/queries';
import { radius, space, useTheme } from '@/theme';
import { Button, Text } from '@/ui';

// The server's own message for a 429; any other failure reads as "couldn't check".
const LIMIT = "You've reached the health check limit for now. Try again later.";

/** Latest health result (or what's happening instead) and the button that starts a new check. */
export function HealthCard({ plantId, latest }: { plantId: string; latest?: Scan | null }) {
  const router = useRouter();
  const { colors } = useTheme();
  const result = latest?.health as HealthResult | null | undefined;
  const check = useHealthCheckStatus(plantId);
  const failed = check?.status === 'error';
  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <Text variant="headline" accessibilityRole="header">
        Health
      </Text>
      {check?.status === 'pending' ? (
        <Text variant="subheadline" accessibilityLiveRegion="polite">
          Looking at your plant…
        </Text>
      ) : latest && result ? (
        <>
          <Text variant="footnote" color="secondaryLabel">
            {`Checked ${new Date(latest.created_at).toLocaleDateString()}`}
          </Text>
          <Text variant="subheadline">{result.note}</Text>
          {result.advice ? <Text variant="subheadline">{result.advice}</Text> : null}
        </>
      ) : (
        <Text variant="subheadline" color="secondaryLabel">
          Not checked yet.
        </Text>
      )}
      <Button label="Check its health" variant="line" onPress={() => router.push(`/plant/${plantId}/health`)} />
      {failed ? (
        <Text variant="footnote" color="statusNow" accessibilityRole="alert">
          {check.error?.message === LIMIT ? LIMIT : "Couldn't check right now. Try again."}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ card: { borderRadius: radius.group, padding: space.l, gap: space.s } });
