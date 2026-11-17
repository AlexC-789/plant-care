/**
 * Jest stand-in for '@/lib/supabase'. Use with:
 *   jest.mock('@/lib/supabase', () => require('@/test-utils/supabaseMock'));
 */
type AuthListener = (event: string, session: unknown) => void;

let listener: AuthListener | null = null;

export const supabase = {
  auth: {
    getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
    onAuthStateChange: jest.fn((cb: AuthListener) => {
      listener = cb;
      return { data: { subscription: { unsubscribe: jest.fn() } } };
    }),
    signInWithPassword: jest.fn(),
    signUp: jest.fn(),
    resend: jest.fn(),
    signOut: jest.fn().mockResolvedValue({ error: null }),
  },
  from: jest.fn(),
};

/** Simulate Supabase emitting an auth event (e.g. after sign-in). */
export function emitAuthEvent(event: string, session: unknown) {
  listener?.(event, session);
}

export const fakeSession = {
  access_token: 'token',
  user: { id: '11111111-1111-1111-1111-111111111111', email: 'a@example.com' },
};
