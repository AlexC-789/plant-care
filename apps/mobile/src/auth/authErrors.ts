import { isAuthRetryableFetchError } from '@supabase/supabase-js';

const MESSAGES: Record<string, string> = {
  user_already_exists: 'An account with this email already exists. Sign in instead.',
  email_exists: 'An account with this email already exists. Sign in instead.',
  invalid_credentials: 'Email or password is incorrect.',
  email_not_confirmed: 'Confirm your email first. Check your inbox, then sign in.',
  weak_password: 'Password must be at least 8 characters.',
};

const NETWORK = "Can't reach the server. Check your connection and try again.";
const FALLBACK = 'Something went wrong. Please try again.';

export function authErrorMessage(error: unknown): string {
  if (isAuthRetryableFetchError(error) || error instanceof TypeError) return NETWORK;
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === 'string' && code in MESSAGES) return MESSAGES[code];
  return FALLBACK;
}
