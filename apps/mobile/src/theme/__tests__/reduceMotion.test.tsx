import { act, renderHook } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { useReduceMotion } from '@/theme';

afterEach(() => jest.restoreAllMocks());

test('follows the system Reduce Motion setting, including changes', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  let listener: (enabled: boolean) => void = () => {};
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((_event, cb) => {
    listener = cb as (enabled: boolean) => void;
    return { remove: jest.fn() } as never;
  });
  const { result } = await renderHook(() => useReduceMotion());
  expect(result.current).toBe(true);
  await act(async () => listener(false));
  expect(result.current).toBe(false);
});
