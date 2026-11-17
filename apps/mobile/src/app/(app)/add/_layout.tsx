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
        <Stack.Screen name="plant" options={{ title: 'Plant · 1 of 6', headerBackVisible: false, gestureEnabled: false }} />
        <Stack.Screen name="capture" options={{ title: 'Add photos' }} />
        <Stack.Screen name="search" options={{ title: 'Plant type' }} />
      </Stack>
    </AddDraftProvider>
  );
}
