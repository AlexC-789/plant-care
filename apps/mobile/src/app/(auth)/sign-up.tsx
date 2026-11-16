import { Link } from 'expo-router';

import { AuthForm } from '@/auth/AuthForm';
import { supabase } from '@/lib/supabase';

export default function SignUp() {
  return (
    <AuthForm
      title="Create your account"
      submitLabel="Create account"
      passwordAutoComplete="new-password"
      onSubmit={async (email, password) => {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) return { error };
        // No session means the server requires email confirmation first.
        if (!data.session) {
          return { notice: 'Check your email to confirm your account, then sign in.' };
        }
        return {};
      }}
      footer={
        <Link href="/sign-in" replace>
          Already have an account? Sign in
        </Link>
      }
    />
  );
}
