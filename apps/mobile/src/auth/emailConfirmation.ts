/** Where Supabase sends people after they click the confirmation link. */
export const EMAIL_CONFIRMED_URL =
  process.env.EXPO_PUBLIC_EMAIL_CONFIRMED_URL ?? 'http://127.0.0.1:8081/email-confirmed';

/** Minimum gap between confirmation emails; matches `max_frequency` in supabase/config.toml. */
export const RESEND_COOLDOWN_SECONDS = 60;

/** Notices the sign-in screen can show, passed as `?notice=` after sign-up. */
export type SignInNotice = 'confirm-sent' | 'account-created';

export function signInNoticeText(notice: string | undefined, email: string): string | undefined {
  if (notice === 'confirm-sent') {
    return `We sent a confirmation link to ${email}. Confirm your email, then sign in.`;
  }
  if (notice === 'account-created') return 'Account created. Sign in to continue.';
  return undefined;
}
