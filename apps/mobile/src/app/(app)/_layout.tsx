import { Link, Redirect, Stack, useRouter } from 'expo-router';
import { Platform, Pressable, View } from 'react-native';

import { useSession } from '@/auth/AuthProvider';
import { CloseButton } from '@/navigation/CloseButton';
import { fonts, space, typography, useTheme } from '@/theme';
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

/** Ink round + (SCREEN_SPECIFICATIONS §11); the 44 pt target wraps a 36 pt disc. */
function AddButton() {
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add a plant"
      onPress={() => router.push('/add/photo')}
      style={{
        width: space.touch,
        height: space.touch,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <View
        style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="plus" size={20} color="onTint" />
      </View>
    </Pressable>
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
          headerLargeTitleStyle: {
            fontFamily: fonts.condensed,
            color: colors.label,
          },
          // Large titles are iOS-only; elsewhere the condensed title sits in the bar.
          headerTitleStyle:
            Platform.OS === 'ios'
              ? { color: colors.label }
              : { fontFamily: fonts.condensed, fontSize: typography.largeTitle.fontSize, color: colors.label },
          headerRight: () => (
            <View style={{ flexDirection: 'row' }}>
              <SettingsButton />
              <AddButton />
            </View>
          ),
        }}
      />
      <Stack.Screen name="add" options={{ presentation: 'fullScreenModal', headerShown: false }} />
      <Stack.Screen
        name="plant/[id]/edit"
        options={{ presentation: 'modal', title: 'Edit plant', headerBackVisible: false }}
      />
      <Stack.Screen
        name="plant/[id]/watering"
        options={{ presentation: 'modal', title: 'How watering works', headerBackVisible: false, headerRight: CloseButton }}
      />
      <Stack.Screen
        name="plant/[id]/photos"
        options={{ presentation: 'fullScreenModal', title: 'Photos', headerBackVisible: false, headerRight: CloseButton }}
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
