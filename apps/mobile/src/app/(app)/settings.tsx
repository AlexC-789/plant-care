import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useSession } from '@/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/profile/useProfile';

const UNITS = [
  { value: 'metric', label: 'Metric' },
  { value: 'imperial', label: 'Imperial' },
] as const;

export default function Settings() {
  const { session } = useSession();
  const { profile, error, update } = useProfile();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Email</Text>
      <Text style={styles.value}>{session?.user.email}</Text>

      <Text style={styles.label}>Display name</Text>
      {/* Remount when the saved name changes so the field shows the server value. */}
      <NameField
        key={profile?.display_name ?? ''}
        saved={profile?.display_name ?? ''}
        onSave={(value) => void update({ display_name: value || null })}
      />

      <Text style={styles.label}>Units</Text>
      <View style={styles.segmented}>
        {UNITS.map(({ value, label }) => {
          const selected = profile?.units === value;
          return (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected }}
              onPress={() => {
                if (!selected) void update({ units: value });
              }}
              style={[styles.segment, selected && styles.segmentSelected]}>
              <Text style={selected ? styles.segmentTextSelected : undefined}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Subscription</Text>
      <Text style={styles.value}>
        {profile?.subscription_status === 'active' ? 'Active' : 'Free (testing)'}
      </Text>

      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        onPress={() => {
          // Local scope clears this device's session even when offline.
          void supabase.auth.signOut({ scope: 'local' });
        }}
        style={styles.signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

function NameField({ saved, onSave }: { saved: string; onSave: (value: string) => void }) {
  const [name, setName] = useState(saved);

  function save() {
    const trimmed = name.trim();
    if (trimmed !== saved) onSave(trimmed);
  }

  return (
    <TextInput
      accessibilityLabel="Display name"
      style={styles.input}
      value={name}
      onChangeText={setName}
      onBlur={save}
      onSubmitEditing={save}
      placeholder="Your name"
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 8 },
  label: { marginTop: 12, fontSize: 13, color: '#666', textTransform: 'uppercase' },
  value: { fontSize: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  segmented: { flexDirection: 'row', gap: 8 },
  segment: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  segmentSelected: { backgroundColor: '#2e7d32', borderColor: '#2e7d32' },
  segmentTextSelected: { color: '#fff', fontWeight: '600' },
  error: { color: '#b00020', marginTop: 12 },
  signOut: { marginTop: 32, paddingVertical: 12, alignItems: 'center' },
  signOutText: { color: '#b00020', fontSize: 16, fontWeight: '600' },
});
