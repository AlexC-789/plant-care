import { Slot } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { AuthProvider, useSession } from '@/auth/AuthProvider';

function RootNavigator() {
  const { isLoading } = useSession();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator testID="auth-loading" size="large" />
      </View>
    );
  }

  // (app) and (auth) layouts redirect based on the session.
  return <Slot />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
