import { Stack } from 'expo-router';

import { AddDraftProvider } from '@/plants/addDraft';
import { useTheme } from '@/theme';

/** The add-a-pot flow: one draft shared by its screens, gone when the cover closes. */
export default function AddLayout() {
  const { colors } = useTheme();
  return (
    <AddDraftProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
          headerTintColor: colors.tint,
          headerTitleStyle: { color: colors.label },
          contentStyle: { backgroundColor: colors.background },
        }}>
        {/* shortcut: no step count until the device steps (module, Wi-Fi, pot, stake, tank) exist; then "Plant · 1 of 6" returns. */}
        <Stack.Screen name="photo" options={{ title: 'Add a plant', headerBackVisible: false, gestureEnabled: false }} />
        <Stack.Screen name="identify" options={{ title: 'Add a plant' }} />
        <Stack.Screen name="where" options={{ title: 'Add a plant' }} />
        <Stack.Screen name="health" options={{ title: 'Add a plant', headerBackVisible: false, gestureEnabled: false }} />
        <Stack.Screen name="plant" options={{ title: 'Add a plant', headerBackVisible: false, gestureEnabled: false }} />
        <Stack.Screen name="capture" options={{ title: 'Add photos' }} />
        <Stack.Screen name="search" options={{ title: 'Plant type' }} />
      </Stack>
    </AddDraftProvider>
  );
}
