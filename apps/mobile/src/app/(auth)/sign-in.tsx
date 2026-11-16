import { Link } from 'expo-router';

import { AuthForm } from '@/auth/AuthForm';
import { supabase } from '@/lib/supabase';

export default function SignIn() {
  return (
    <AuthForm
      title="Welcome back"
      submitLabel="Sign in"
      passwordAutoComplete="current-password"
      onSubmit={async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
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
