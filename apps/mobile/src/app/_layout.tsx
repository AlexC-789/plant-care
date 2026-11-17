import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Slot, ThemeProvider } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { AuthProvider, useSession } from '@/auth/AuthProvider';
import { queryClient } from '@/lib/queryClient';
import { useTheme } from '@/theme';
import { ShimmerProvider } from '@/ui';

function RootNavigator() {
  const { isLoading } = useSession();
  const { colors } = useTheme();

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
        }}>
        <ActivityIndicator testID="auth-loading" size="large" color={colors.secondaryLabel} />
      </View>
    );
  }

  // (app) and (auth) layouts redirect based on the session.
  return <Slot />;
}

export default function RootLayout() {
  const { scheme, colors } = useTheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.tint,
      background: colors.background,
      card: colors.background,
      text: colors.label,
      border: colors.separator,
      notification: colors.statusNow,
    },
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={navTheme}>
        <ShimmerProvider>
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        </ShimmerProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
