import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Slot, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { View } from 'react-native';

import { AuthProvider, useSession } from '@/auth/AuthProvider';
import { LaunchAnimation } from '@/launch/LaunchAnimation';
import { useLaunchGate } from '@/launch/useLaunchGate';
import { queryClient } from '@/lib/queryClient';
import { loadStoredAppearance, useAppearanceLoaded, useTheme } from '@/theme';
import { ShimmerProvider } from '@/ui';

// Keep the native splash (plain paper) up until the launch animation's first frame is on
// screen, so the hand-off is paper to paper with no flash.
void SplashScreen.preventAutoHideAsync().catch(() => {});
const hideSplash = () => void SplashScreen.hideAsync().catch(() => {});

function RootNavigator() {
  const { isLoading } = useSession();
  const { colors } = useTheme();
  const appearanceLoaded = useAppearanceLoaded();
  const { mounted, fadingOut, onAnimationDone, onExited } = useLaunchGate(isLoading);

  // Read the saved Light/Dark choice before showing anything (a few ms; the native splash
  // covers it), so Dark users never see a light first frame.
  useEffect(() => {
    if (!appearanceLoaded) void loadStoredAppearance();
  }, [appearanceLoaded]);

  // Without a launch animation (e.g. the root remounted), hide the native splash now;
  // otherwise the overlay hides it once its first frame is on screen.
  useEffect(() => {
    if (appearanceLoaded && !mounted) hideSplash();
  }, [appearanceLoaded, mounted]);

  if (!appearanceLoaded) return null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* (app) and (auth) layouts redirect based on the session. */}
      {isLoading ? null : <Slot />}
      {mounted ? (
        <LaunchAnimation
          onDone={onAnimationDone}
          fadingOut={fadingOut}
          onExited={onExited}
          onReady={hideSplash}
        />
      ) : null}
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
