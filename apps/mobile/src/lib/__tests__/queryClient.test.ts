import { AppState } from 'react-native';

test('cached data is kept for a day, so screens reopen instantly', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- module under test
  const { queryClient } = require('@/lib/queryClient');
  expect(queryClient.getDefaultOptions().queries.gcTime).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000);
});

test('returning to the app refreshes data (app state drives query focus)', () => {
  let listener: (state: string) => void = () => {};
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, cb) => {
    listener = cb as (state: string) => void;
    return { remove: jest.fn() } as never;
  });
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- same module copy as the cache
    const { focusManager } = require('@tanstack/react-query');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/lib/queryClient');
    listener('background');
    expect(focusManager.isFocused()).toBe(false);
    listener('active');
    expect(focusManager.isFocused()).toBe(true);
  });
});
