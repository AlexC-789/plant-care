import { Link, Redirect, Stack, useRouter } from 'expo-router';
import { Platform, Pressable, View } from 'react-native';

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

function AddButton() {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add a pot"
      onPress={() => router.push('/add/photo')}
      style={{
        width: space.touch,
        height: space.touch,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Icon name="plus" size={24} color="tint" />
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
            fontFamily: serifFamily,
            color: colors.label,
          },
          // Large titles are iOS-only; elsewhere the serif title sits in the bar.
          headerTitleStyle:
            Platform.OS === 'ios'
              ? { color: colors.label }
              : { fontFamily: serifFamily, fontSize: 28, color: colors.label },
          headerRight: () => (
            <View style={{ flexDirection: 'row' }}>
              <AddButton />
              <SettingsButton />
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
