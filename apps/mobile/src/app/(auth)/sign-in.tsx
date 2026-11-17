import { Link, useLocalSearchParams } from 'expo-router';

import { AuthForm } from '@/auth/AuthForm';
import { EMAIL_CONFIRMED_URL, signInNoticeText } from '@/auth/emailConfirmation';
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
      resendCooldownFromStart={notice === 'confirm-sent'}
      onResendConfirmation={async (address) => {
        const { error } = await supabase.auth.resend({
          type: 'signup',
          email: address,
          options: { emailRedirectTo: EMAIL_CONFIRMED_URL },
        });
        return error ? { error } : { notice: `Confirmation email sent to ${address}.` };
      }}
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
