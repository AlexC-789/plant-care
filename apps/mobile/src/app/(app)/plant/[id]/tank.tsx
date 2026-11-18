import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { TankVessel } from '@/devices/TankVessel';
import { useDevice } from '@/devices/queries';
import { space } from '@/theme';
import { BottomBar, Button, StepDone, Text } from '@/ui';

const SUCCESS_MS = 700;
const FALLBACK_FULL_ML = 705;

/** Setup step 2: watch the tank fill. */
export default function TankSetup() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data } = useDevice(id, 5000);
  const ml = data?.water_left_ml ?? null;
  const fullMl = data?.tank_full_ml ?? FALLBACK_FULL_ML;
  const full = ml !== null && ml >= 0.9 * fullMl;

  useEffect(() => {
    if (!full) return;
    const t = setTimeout(() => router.back(), SUCCESS_MS);
    return () => clearTimeout(t);
  }, [full, router]);

  return (
    <>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        {full ? (
          <StepDone title="The tank is full." />
        ) : (
          <>
            <Text variant="title" accessibilityRole="header">
              Fill the tank
            </Text>
            <Text>Open the cap on the saucer and pour until the water reaches the top of the hole.</Text>
            <TankVessel ml={ml} fullMl={fullMl} width={84} />
          </>
        )}
      </ScrollView>
      <BottomBar>
        <Button label="Done" onPress={() => router.back()} />
      </BottomBar>
    </>
  );
}

const styles = StyleSheet.create({ content: { padding: space.l, gap: space.l, alignItems: 'flex-start' } });
