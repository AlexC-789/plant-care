import { clearConfirmationUrl, readConfirmationUrl } from '@/auth/confirmationUrl.web';

const replaceState = jest.fn();

beforeEach(() => {
  replaceState.mockClear();
  (globalThis as unknown as { window: unknown }).window = {
    location: {
      pathname: '/email-confirmed',
      search: '?x=1',
      hash: '#access_token=secret&type=signup',
    },
    history: { replaceState },
  };
});

afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window;
});

test('reads the query and fragment without changing the address bar', () => {
  expect(readConfirmationUrl()).toEqual({ search: '?x=1', hash: '#access_token=secret&type=signup' });
  expect(replaceState).not.toHaveBeenCalled();
});

test('clearing removes query and fragment (Supabase puts tokens there)', () => {
  clearConfirmationUrl();
  expect(replaceState).toHaveBeenCalledWith(null, '', '/email-confirmed');
});
