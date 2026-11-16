import { act, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { AuthProvider, useSession } from '@/auth/AuthProvider';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
  },
}));

const auth = supabase.auth as unknown as {
  getSession: jest.Mock;
  onAuthStateChange: jest.Mock;
};

const fakeSession = { access_token: 't', user: { id: 'u1', email: 'a@example.com' } };
let authListener: (event: string, session: unknown) => void;
const unsubscribe = jest.fn();

function Probe() {
  const { session, isLoading } = useSession();
  return (
    <Text testID="probe">
      {isLoading ? 'loading' : session ? `signed-in:${session.user.id}` : 'signed-out'}
    </Text>
  );
}

function renderProvider() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  auth.onAuthStateChange.mockImplementation((cb) => {
    authListener = cb;
    return { data: { subscription: { unsubscribe } } };
  });
});

test('is loading until the stored session has been read', async () => {
  let resolve!: (v: unknown) => void;
  auth.getSession.mockReturnValue(new Promise((r) => (resolve = r)));
  await renderProvider();
  expect(screen.getByTestId('probe')).toHaveTextContent('loading');
  await act(async () => resolve({ data: { session: null }, error: null }));
  expect(screen.getByTestId('probe')).toHaveTextContent('signed-out');
});

test('exposes a stored session', async () => {
  auth.getSession.mockResolvedValue({ data: { session: fakeSession }, error: null });
  await renderProvider();
  await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('signed-in:u1'));
});

test('a failed refresh of the stored session ends signed out, not loading', async () => {
  auth.getSession.mockResolvedValue({
    data: { session: null },
    error: { name: 'AuthApiError', message: 'Invalid Refresh Token' },
  });
  await renderProvider();
  await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('signed-out'));
});

test('a rejected session read ends signed out, not loading', async () => {
  auth.getSession.mockRejectedValue(new TypeError('Network request failed'));
  await renderProvider();
  await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('signed-out'));
});

test('follows sign-out events and unsubscribes on unmount', async () => {
  auth.getSession.mockResolvedValue({ data: { session: fakeSession }, error: null });
  const view = await renderProvider();
  await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('signed-in:u1'));
  await act(async () => authListener('SIGNED_OUT', null));
  expect(screen.getByTestId('probe')).toHaveTextContent('signed-out');
  await view.unmount();
  expect(unsubscribe).toHaveBeenCalled();
});
