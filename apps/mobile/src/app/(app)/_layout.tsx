import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/auth/AuthProvider';

export default function AppLayout() {
  const { session } = useSession();
  if (!session) return <Redirect href="/sign-in" />;
  return <Stack screenOptions={{ title: 'My plants' }} />;
}
