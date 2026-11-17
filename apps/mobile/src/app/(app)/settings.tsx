import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { useSession } from '@/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { useProfile, type ProfileUpdate } from '@/profile/useProfile';
import { space, typography, useTheme } from '@/theme';
import { Button, InsetGroup, Row, Text } from '@/ui';

type Units = NonNullable<ProfileUpdate['units']>;

const UNITS: { value: Units; label: string }[] = [
  { value: 'auto', label: 'Automatic' },
  { value: 'metric', label: 'Metric' },
  { value: 'imperial', label: 'Imperial' },
];

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export default function Settings() {
  const { session } = useSession();
  const { profile, error, update } = useProfile();
  const { colors } = useTheme();

  return (
    <View style={[styles.sheet, { backgroundColor: colors.background }]}>
      <View style={styles.bar}>
        <View style={styles.barSide} />
        <Text variant="headline" accessibilityRole="header">
          Settings
        </Text>
        <View style={[styles.barSide, styles.barRight]}>
          <Button label="Done" variant="plain" onPress={close} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <InsetGroup header="Profile">
          <Row label="Name">
            {/* Remount when the saved name changes so the field shows the server value. */}
            <NameField
              key={profile?.display_name ?? ''}
              saved={profile?.display_name ?? ''}
              onSave={(value) => void update({ display_name: value || null })}
            />
          </Row>
        </InsetGroup>

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
    </View>
  );
}

function NameField({ saved, onSave }: { saved: string; onSave: (value: string) => void }) {
  const { colors } = useTheme();
  const [name, setName] = useState(saved);

  function save() {
    const trimmed = name.trim();
    if (trimmed !== saved) onSave(trimmed);
  }

  return (
    <TextInput
      accessibilityLabel="Display name"
      style={[typography.body, styles.nameInput, { color: colors.label }]}
      placeholderTextColor={colors.secondaryLabel}
      value={name}
      onChangeText={setName}
      onBlur={save}
      onSubmitEditing={save}
      placeholder="Your name"
      textAlign="right"
    />
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.s,
    paddingTop: space.s,
    minHeight: space.touch + space.s,
  },
  barSide: { flex: 1 },
  barRight: { alignItems: 'flex-end' },
  content: { padding: space.l, gap: space.xxl, paddingBottom: space.xxxl },
  nameInput: { flex: 1, minHeight: space.touch - space.m * 2, padding: 0, textAlign: 'right' },
  error: { marginHorizontal: space.xs },
});
