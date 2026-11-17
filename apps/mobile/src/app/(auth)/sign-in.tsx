import { Link, useLocalSearchParams } from 'expo-router';

import { AuthForm } from '@/auth/AuthForm';
import { signInNoticeText } from '@/auth/emailConfirmation';
import { supabase } from '@/lib/supabase';

export default function SignIn() {
  const { email = '', notice } = useLocalSearchParams<{ email?: string; notice?: string }>();

  return (
    <AuthForm
      title="Welcome back"
      submitLabel="Sign in"
      passwordAutoComplete="current-password"
      initialEmail={email}
      initialNotice={signInNoticeText(notice, email)}
      onSubmit={async (address, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email: address, password });
        // On success the session listener redirects to the library.
        return { error: error ?? undefined };
      }}
      footer={
        <Link href="/sign-up" replace>
          Don&apos;t have an account? Sign up
        </Link>
      }
    />
  );
}
