export const MIN_PASSWORD_LENGTH = 8;

export type CredentialErrors = { email?: string; password?: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCredentials(email: string, password: string): CredentialErrors {
  const errors: CredentialErrors = {};
  const trimmed = email.trim();
  if (!trimmed) errors.email = 'Enter your email.';
  else if (!EMAIL_PATTERN.test(trimmed)) errors.email = 'Enter a valid email address.';
  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return errors;
}
