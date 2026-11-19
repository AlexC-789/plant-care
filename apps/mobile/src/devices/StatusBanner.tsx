import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { radius, space, useTheme } from '@/theme';
import { Button, Text } from '@/ui';

import type { Device } from './api';
import { useResumeWatering } from './queries';
import { type Status, type StatusKey } from './status';

const HEADLINE: Partial<Record<StatusKey, string>> = {
  setup: "Setup isn't finished",
  fault: 'Watering stopped',
  tank: 'Tank needs refilling',
  offline: 'Module offline',
  battery: 'Battery is low',
};

/** The one thing the module needs from you, if anything. */
export function StatusBanner({ status, device, plantId }: { status: Status; device: Device | null; plantId: string }) {
  const router = useRouter();
  const { colors } = useTheme();
  const resume = useResumeWatering(plantId);
  const [now] = useState(() => Date.now());
  if (!status.banner && status.key !== 'setup') return null;
  const canResume = status.key === 'fault' && device?.fault_code === 'no_moisture_rise';
  const next = device && new Date(Math.max(now, new Date(device.last_seen_at ?? device.created_at).getTime() + device.sync_interval_s * 1000));
  return (
    <View style={[styles.banner, { backgroundColor: colors.surface }]}>
      <Text variant="headline">{HEADLINE[status.key]}</Text>
      <Text variant="subheadline">{status.banner ?? 'Add its module to start watering automatically.'}</Text>
      {status.key === 'setup' ? <Button label="Add its module" onPress={() => router.push(`/plant/${plantId}/module`)} /> : null}
      {canResume && device?.resumePending && next ? (
        <Text variant="subheadline" color="secondaryLabel">{`Resumes at the next check-in, by about ${next.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}</Text>
      ) : canResume && device ? (
        <Button label="Resume watering" busy={resume.isPending} disabled={resume.isPending} onPress={() => resume.mutate(device.id)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ banner: { borderRadius: radius.group, padding: space.l, gap: space.s } });
