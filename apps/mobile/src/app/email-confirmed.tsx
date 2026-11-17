import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { clearConfirmationUrl, readConfirmationUrl } from '@/auth/confirmationUrl';
import { confirmationResult } from '@/auth/emailConfirmation';

const COPY = {
  confirmed: { title: 'Email confirmed', body: 'Go back to the app and sign in.' },
  expired: {
    title: 'Link expired',
    body: "This link has expired or was already used. Sign in and we'll send you a new one.",
  },
} as const;

/**
 * Public page Supabase redirects to after verifying a confirmation link.
 * It only shows a message; it never signs anyone in.
 */
export default function EmailConfirmed() {
  const [result] = useState(() => {
    const { search, hash } = readConfirmationUrl();
    return confirmationResult(search, hash);
  });

  useEffect(() => {
    clearConfirmationUrl();
  }, []);

  const { title, body } = COPY[result];
  return (
    <View style={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.body}>{body}</Text>
      <Link href="/sign-in" style={styles.link}>
        Sign in
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
    backgroundColor: '#fff',
  },
  title: { fontSize: 26, fontWeight: '600' },
  body: { fontSize: 16, color: '#444', textAlign: 'center' },
  link: { marginTop: 12, color: '#2e7d32', fontSize: 16, fontWeight: '600' },
});
