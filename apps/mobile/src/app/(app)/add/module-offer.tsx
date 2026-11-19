import { Redirect, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { BackHandler, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { plantName, useAddDraft } from '@/plants/addDraft';
import { space, useTheme } from '@/theme';
import { BottomBar, Button, Row, Text } from '@/ui';

const NEEDS = ['The module and its stake', 'Water for the tank', 'Your Wi-Fi password'];

/** Last step of the add flow: offer the module. Not now keeps the plant as it is ("No module"). */
export default function ModuleOffer() {
  const router = useRouter();
  const { colors } = useTheme();
  const { draft } = useAddDraft();

  const home = () => router.dismissTo('/');
  useEffect(() => {
    if (Platform.OS === 'web') return; // react-native-web's BackHandler throws
    const sub = BackHandler.addEventListener('hardwareBackPress', () => (home(), true));
    return () => sub.remove();
  });

  if (!draft.plantId) return <Redirect href="/add/capture" />;
  const name = plantName(draft);

  return (
    <View style={styles.flex}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <Text variant="largeTitle" accessibilityRole="header">
          {`Does ${name} have a module?`}
        </Text>
        <Text>
          The Plant Care module sits in the saucer, reads the soil and waters from its own tank. Setting one up takes about two minutes.
        </Text>
        <View>
          {NEEDS.map((n, i) => (
            <View key={n} style={i ? { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.separator } : undefined}>
              <Row label={i ? '' : "You'll need"} value={n} />
            </View>
          ))}
        </View>
      </ScrollView>
      <BottomBar>
        <Button
          label="Set up the module"
          onPress={() => {
            home();
            router.push(`/plant/${draft.plantId}/module`);
          }}
        />
        <Button label="Not now" variant="plain" onPress={home} />
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: space.xl, gap: space.xl },
});
