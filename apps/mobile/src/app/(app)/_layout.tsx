import { Link, Redirect, Stack } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { useSession } from '@/auth/AuthProvider';

function SettingsButton() {
  return (
    <Link href="/settings" asChild>
      <Pressable accessibilityRole="button" accessibilityLabel="Settings" hitSlop={8}>
        <Text style={{ color: '#2e7d32', fontSize: 16 }}>Settings</Text>
      </Pressable>
    </Link>
  );
}

export default function AppLayout() {
  const { session } = useSession();
  if (!session) return <Redirect href="/sign-in" />;
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'My plants', headerRight: SettingsButton }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
    </Stack>
  );
}
