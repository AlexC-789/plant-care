import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Slot, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { View } from 'react-native';

import { AuthProvider, useSession } from '@/auth/AuthProvider';
import { LaunchAnimation } from '@/launch/LaunchAnimation';
import { useLaunchGate } from '@/launch/useLaunchGate';
import { queryClient } from '@/lib/queryClient';
import { useTheme } from '@/theme';
import { ShimmerProvider } from '@/ui';

// Keep the native splash (the same pot drawing) up until the launch animation takes over.
void SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { isLoading } = useSession();
  const { colors } = useTheme();
  const { showLaunch, onAnimationDone } = useLaunchGate(isLoading);

  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* (app) and (auth) layouts redirect based on the session. */}
      {isLoading ? null : <Slot />}
      {showLaunch ? <LaunchAnimation onDone={onAnimationDone} /> : null}
    </View>
  );
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
