import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import type { HealthResult as Result } from '@/plants/api';
import { radius, space, useTheme } from '@/theme';
import { FadeIn, Icon, Text } from '@/ui';

const STATUS = {
  true: { icon: 'healthy', color: 'statusFine', label: 'Looks healthy' },
  false: { icon: 'error', color: 'statusSoon', label: 'Needs attention' },
  null: { icon: 'unsure', color: 'statusQuiet', label: 'Not sure' },
} as const;

/** The status line, note and what to do for a finished check. */
export function HealthText({ result }: { result: Result }) {
  const { colors } = useTheme();
  const status = STATUS[`${result.healthy}` as keyof typeof STATUS];
  return (
    <>
      <View style={styles.status}>
        <Icon name={status.icon} size={18} color={status.color} />
        <Text variant="subheadline" color={status.color}>
          {status.label}
        </Text>
      </View>
      <Text variant="title3" accessibilityRole="header">
        {result.note}
      </Text>
      {result.advice ? (
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.status}>
            <Icon name="care" size={18} color="tint" />
            <Text variant="headline" accessibilityRole="header">
              What to do
            </Text>
          </View>
          <Text variant="body">{result.advice}</Text>
        </View>
      ) : null}
    </>
  );
}

/** A finished health check: the checked photo, then its text. */
export function HealthResult({ result, photoUri }: { result: Result; photoUri?: string }) {
  return (
    <FadeIn style={styles.result}>
      {photoUri ? <Image accessibilityLabel="Checked photo" source={{ uri: photoUri }} style={styles.photo} /> : null}
      <HealthText result={result} />
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  result: { gap: space.l },
  photo: { aspectRatio: 4 / 3, borderRadius: radius.thumb },
  status: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  card: { borderRadius: radius.group, padding: space.l, gap: space.s },
});
