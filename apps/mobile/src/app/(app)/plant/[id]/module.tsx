import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { useQueryClient } from '@tanstack/react-query';

import { useCreateClaim, useDevice } from '@/devices/queries';
import { timeLabel } from '@/devices/status';
import { space } from '@/theme';
import { BottomBar, Button, FadeIn, InsetGroup, LoadingGroup, Row, SkeletonRow, Text } from '@/ui';

/** Setup step 1: a one-time claim code; the screen waits until the module claims it. */
export default function ModuleSetup() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const claim = useCreateClaim(id);
  const { mutate: makeClaim } = claim;
  const device = useDevice(id, 5000);
  const [now, setNow] = useState(() => Date.now());
  // Survives StrictMode's double effect and re-renders: one claim per visit.
  const started = useRef(false);
  const hasModule = !!device.data;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (hasModule) {
      void queryClient.invalidateQueries({ queryKey: ['plants'] }); // Home must not keep saying setup is unfinished
      router.replace(`/plant/${id}/tank`);
    }
    else if (device.isSuccess && !started.current) {
      started.current = true;
      makeClaim();
    }
  }, [hasModule, device.isSuccess, id, router, makeClaim, queryClient]);

  const code = claim.data?.code;
  const expired = !!claim.data && now > new Date(claim.data.expires_at).getTime();

  return (
    <>
      <Stack.Screen options={{ title: '' }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <Text variant="largeTitle" accessibilityRole="header">
          Add its module
        </Text>
        {claim.isError || (device.isError && !device.data) ? (
          <>
            <Text color="statusNow" accessibilityRole="alert">
              {"Couldn't make a code. Try again."}
            </Text>
            <Button label="Try again" onPress={() => (claim.isError ? makeClaim() : void device.refetch())} />
          </>
        ) : expired ? (
          <>
            <Text accessibilityRole="alert">This code expired.</Text>
            <Button label="New code" onPress={() => claim.mutate()} />
          </>
        ) : claim.data && code ? (
          <FadeIn>
            <Text variant="title" selectable>
              {code.replace(/(.{4})(?=.)/g, '$1 ')}
            </Text>
            <Text>
              Simulated module: on your computer run `node sim/sim.ts --claim {code}`. The real module receives this
              code over its own Wi-Fi during setup.
            </Text>
            <InsetGroup>
              <Row label="Waiting for the module…" />
              <Row label={`Code expires at ${timeLabel(claim.data.expires_at, new Date(now))}`} />
            </InsetGroup>
          </FadeIn>
        ) : (
          <LoadingGroup>
            <InsetGroup>
              <SkeletonRow />
              <SkeletonRow />
            </InsetGroup>
          </LoadingGroup>
        )}
      </ScrollView>
      <BottomBar>
        <Button label="Done" variant="plain" onPress={() => router.back()} />
      </BottomBar>
    </>
  );
}

const styles = StyleSheet.create({ content: { padding: space.l, gap: space.l } });
