import { renderHook } from '@testing-library/react-native';

import { useIsAccessibilitySize } from '@/theme';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(),
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports -- the mocked module above
const useWindowDimensions: jest.Mock = require('react-native/Libraries/Utilities/useWindowDimensions').default;

afterEach(() => jest.restoreAllMocks());

test.each([
  [1.3, false],
  [1.5, true],
])('useIsAccessibilitySize at font scale %p → %p', async (fontScale, expected) => {
  useWindowDimensions.mockReturnValue({ width: 390, height: 844, scale: 3, fontScale });
  const { result } = await renderHook(() => useIsAccessibilitySize());
  expect(result.current).toBe(expected);
});
