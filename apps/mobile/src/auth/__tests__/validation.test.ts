import { validateCredentials } from '@/auth/validation';

test('empty email and short password both report', () => {
  expect(validateCredentials('', 'x')).toEqual({
    email: 'Enter your email.',
    password: 'Password must be at least 8 characters.',
  });
});

test('malformed email is rejected', () => {
  expect(validateCredentials('a@b', '12345678')).toEqual({ email: 'Enter a valid email address.' });
});

test('surrounding whitespace in the email is ignored', () => {
  expect(validateCredentials('  me@x.com ', '12345678')).toEqual({});
});
