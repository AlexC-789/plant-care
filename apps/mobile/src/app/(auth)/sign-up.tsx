import { router } from 'expo-router';

import { AuthForm } from '@/auth/AuthForm';
import { EMAIL_CONFIRMED_URL, type SignInNotice } from '@/auth/emailConfirmation';
import { supabase } from '@/lib/supabase';
import { TextLink } from '@/ui';

export default function SignUp() {
  return (
    <AuthForm
      title="Create your account"
      submitLabel="Create account"
      passwordAutoComplete="new-password"
      onSubmit={async (email, password) => {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: EMAIL_CONFIRMED_URL },
        });
        if (error) return { error };
        // With email confirmation on, Supabase hides existing accounts by returning a
        // placeholder user with no identities instead of an error.
        if (data.user && data.user.identities?.length === 0) {
          return { error: { code: 'user_already_exists' } };
        }
        // Signing in after sign-up is always required. If the server skipped
        // confirmation and returned a session, drop it on this device.
        let notice: SignInNotice = 'confirm-sent';
        if (data.session) {
          await supabase.auth.signOut({ scope: 'local' });
          notice = 'account-created';
        }
        router.replace({ pathname: '/sign-in', params: { email, notice } });
        return {};
      }}
      footer={<TextLink href="/sign-in" replace label="Already have an account? Sign in" />}
    />
  );
}
