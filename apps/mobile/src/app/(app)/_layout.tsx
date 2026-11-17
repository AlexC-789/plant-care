import { Link, Redirect, Stack } from 'expo-router';
import { Platform, Pressable } from 'react-native';

import { useSession } from '@/auth/AuthProvider';
import { CloseButton } from '@/navigation/CloseButton';
import { serifFamily, space, useTheme } from '@/theme';
import { Icon } from '@/ui';

// Settings is a sheet over Plants, even when opened directly from a link.
export const unstable_settings = { anchor: 'index' };

function SettingsButton() {
  return (
    <Link href="/settings" asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Settings"
        style={{
          width: space.touch,
          height: space.touch,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Icon name="account" size={24} color="tint" />
      </Pressable>
    </Link>
  );
}

export default function AppLayout() {
  const { session } = useSession();
  const { colors } = useTheme();
  if (!session) return <Redirect href="/sign-in" />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTintColor: colors.tint,
        headerTitleStyle: { color: colors.label },
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Screen
        name="index"
        options={{
          title: 'Plants',
          headerLargeTitle: true,
          headerLargeTitleShadowVisible: false,
          headerLargeTitleStyle: { fontFamily: serifFamily, color: colors.label },
          // Large titles are iOS-only; elsewhere the serif title sits in the bar.
          headerTitleStyle:
            Platform.OS === 'ios'
              ? { color: colors.label }
              : { fontFamily: serifFamily, fontSize: 28, color: colors.label },
          headerRight: SettingsButton,
        }}
      />
      <Stack.Screen
        name="settings"
        options={{
          // iOS page sheet with the native navigation bar (title + Done).
          presentation: 'modal',
          title: 'Settings',
          headerBackVisible: false,
          headerRight: CloseButton,
        }}
      />
    </Stack>
  );
}
