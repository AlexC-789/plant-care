import { ScrollView, StyleSheet } from 'react-native';

import { useSession } from '@/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { useProfile, type ProfileUpdate } from '@/profile/useProfile';
import { space, useTheme } from '@/theme';
import { InsetGroup, Row, Text } from '@/ui';

type Units = NonNullable<ProfileUpdate['units']>;

const UNITS: { value: Units; label: string }[] = [
  { value: 'auto', label: 'Automatic' },
  { value: 'metric', label: 'Metric' },
  { value: 'imperial', label: 'Imperial' },
];

/** Shown as a sheet; the navigation bar (title + Done) comes from the (app) stack. */
export default function Settings() {
  const { session } = useSession();
  const { profile, error, update } = useProfile();
  const { colors } = useTheme();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}>
      <InsetGroup header="Units" footer="Automatic follows your phone's region.">
        {UNITS.map(({ value, label }) => {
          const selected = profile?.units === value;
          return (
            <Row
              key={value}
              label={label}
              accessory={selected ? 'checkmark' : 'none'}
              onPress={() => {
                if (!selected) void update({ units: value });
              }}
            />
          );
        })}
      </InsetGroup>

      <InsetGroup header="Plan">
        <Row
          label="Subscription"
          value={profile?.subscription_status === 'active' ? 'Active' : 'Free (testing)'}
        />
      </InsetGroup>

      <InsetGroup header="Account">
        <Row label="Email" value={session?.user.email ?? ''} />
        <Row
          label="Sign out"
          destructive
          onPress={() => {
            // Local scope clears this device's session even when offline.
            void supabase.auth.signOut({ scope: 'local' });
          }}
        />
      </InsetGroup>

      {error ? (
        <Text variant="footnote" color="statusNow" accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.l, gap: space.xxl, paddingBottom: space.xxxl },
  error: { marginHorizontal: space.xs },
});
