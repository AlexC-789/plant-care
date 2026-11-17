import { AuthRetryableFetchError } from '@supabase/supabase-js';

import { authErrorMessage } from '@/auth/authErrors';

const NETWORK = "Can't reach the server. Check your connection and try again.";

test.each([
  [{ code: 'user_already_exists' }, 'An account with this email already exists. Sign in instead.'],
  [{ code: 'invalid_credentials' }, 'Email or password is incorrect.'],
  [{ code: 'email_not_confirmed' }, 'Confirm your email first. Check your inbox, then sign in.'],
  [{ code: 'over_email_send_rate_limit' }, 'Too many emails sent. Wait a few minutes and try again.'],
  [{ code: 'weak_password' }, 'Password must be at least 8 characters.'],
  [new AuthRetryableFetchError('Failed to fetch', 0), NETWORK],
  [new TypeError('Network request failed'), NETWORK],
  [new Error('boom'), 'Something went wrong. Please try again.'],
  [null, 'Something went wrong. Please try again.'],
])('maps %p', (error, message) => {
  expect(authErrorMessage(error)).toBe(message);
});
