import { renderHook } from '@testing-library/react-native';
import * as RN from 'react-native';

import { colors, useIsAccessibilitySize, useTheme } from '@/theme';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(),
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports -- the mocked module above
const useWindowDimensions: jest.Mock = require('react-native/Libraries/Utilities/useWindowDimensions').default;

afterEach(() => jest.restoreAllMocks());

test('useTheme follows the system colour scheme', async () => {
  jest.spyOn(RN, 'useColorScheme').mockReturnValue('dark');
  const { result } = await renderHook(() => useTheme());
  expect(result.current.scheme).toBe('dark');
  expect(result.current.colors).toBe(colors.dark);
});

test('useTheme defaults to light when the scheme is unknown', async () => {
  jest.spyOn(RN, 'useColorScheme').mockReturnValue(null);
  const { result } = await renderHook(() => useTheme());
  expect(result.current.colors).toBe(colors.light);
});

test.each([
  [1.3, false],
  [1.5, true],
])('useIsAccessibilitySize at font scale %p → %p', async (fontScale, expected) => {
  useWindowDimensions.mockReturnValue({ width: 390, height: 844, scale: 3, fontScale });
  const { result } = await renderHook(() => useIsAccessibilitySize());
  expect(result.current).toBe(expected);
});
