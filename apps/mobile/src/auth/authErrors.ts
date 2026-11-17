import { isAuthRetryableFetchError } from '@supabase/supabase-js';

const MESSAGES: Record<string, string> = {
  user_already_exists: 'An account with this email already exists. Sign in instead.',
  email_exists: 'An account with this email already exists. Sign in instead.',
  invalid_credentials: 'Email or password is incorrect.',
  email_not_confirmed: 'Confirm your email first. Check your inbox, then sign in.',
  over_email_send_rate_limit: 'Too many emails sent. Wait a few minutes and try again.',
  weak_password: 'Password must be at least 8 characters.',
};

/**
 * Messages from the sign-up email check (supabase/functions/before-user-created/check.ts),
 * written for people, so they're shown as they are. Keep in sync with that file.
 */
const SERVER_MESSAGES = new Set([
  "This email domain can't receive mail. Check the address.",
  "Use a permanent email address. Temporary inboxes can't be used.",
]);

const NETWORK = "Can't reach the server. Check your connection and try again.";
const FALLBACK = 'Something went wrong. Please try again.';

export function authErrorMessage(error: unknown): string {
  if (isAuthRetryableFetchError(error) || error instanceof TypeError) return NETWORK;
  const message = (error as { message?: unknown } | null)?.message;
  if (typeof message === 'string' && SERVER_MESSAGES.has(message)) return message;
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === 'string' && code in MESSAGES) return MESSAGES[code];
  return FALLBACK;
}
