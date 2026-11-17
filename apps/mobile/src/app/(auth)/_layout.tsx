import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/auth/AuthProvider';

export default function AuthLayout() {
  const { session } = useSession();
  if (session) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
