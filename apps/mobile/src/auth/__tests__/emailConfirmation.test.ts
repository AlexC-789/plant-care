import { confirmationResult } from '@/auth/emailConfirmation';

test.each([
  ['', '#access_token=x&refresh_token=y&type=signup', 'confirmed'],
  ['', '', 'confirmed'],
  ['', '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid', 'expired'],
  ['?error=access_denied&error_code=otp_expired', '', 'expired'],
  ['?error_code=otp_expired', '#', 'expired'],
])('search %p hash %p → %p', (search, hash, expected) => {
  expect(confirmationResult(search, hash)).toBe(expected);
});
