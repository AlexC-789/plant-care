import { Stack } from 'expo-router';

import { AddDraftProvider } from '@/plants/addDraft';
import { useTheme } from '@/theme';

/** The add-a-plant flow: one draft shared by its screens, gone when the cover closes. */
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
        {/* Capture and Result draw their own frosted buttons over the camera / photo. */}
        <Stack.Screen name="capture" options={{ headerShown: false, gestureEnabled: false, statusBarStyle: 'light' }} />
        <Stack.Screen name="identify" options={{ headerShown: false }} />
        <Stack.Screen name="where" options={{ title: 'Add a plant' }} />
        <Stack.Screen name="health" options={{ title: 'Add a plant', headerBackVisible: false, gestureEnabled: false }} />
        <Stack.Screen name="module-offer" options={{ title: '', headerBackVisible: false, gestureEnabled: false }} />
        <Stack.Screen name="search" options={{ title: 'Plant type' }} />
      </Stack>
    </AddDraftProvider>
  );
}
