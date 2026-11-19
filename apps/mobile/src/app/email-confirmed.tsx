import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { clearConfirmationUrl, readConfirmationUrl } from '@/auth/confirmationUrl';
import { confirmationResult } from '@/auth/emailConfirmation';
import { space, useTheme } from '@/theme';
import { Text, TextLink } from '@/ui';

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
  const { colors } = useTheme();
  const [result] = useState(() => {
    const { search, hash } = readConfirmationUrl();
    return confirmationResult(search, hash);
  });

  useEffect(() => {
    clearConfirmationUrl();
  }, []);

  const { title, body } = COPY[result];
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text variant="largeTitle" accessibilityRole="header" style={styles.center}>
        {title}
      </Text>
      <Text variant="subheadline" color="secondaryLabel" style={styles.center}>
        {body}
      </Text>
      <TextLink href="/sign-in" label="Sign in" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xxl,
    gap: space.m,
  },
  center: { textAlign: 'center', maxWidth: 360 },
});
