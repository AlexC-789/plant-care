import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { typography } from '@/theme';
import { LoadingGroup, ShimmerProvider, Skeleton, SkeletonRow, SkeletonText } from '@/ui';

let reduceMotion = false;

beforeEach(() => {
  jest.useFakeTimers();
  reduceMotion = false;
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(async () => reduceMotion);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

function renderLoading(children: React.ReactNode) {
  return render(
    <ShimmerProvider>
      <LoadingGroup>{children}</LoadingGroup>
    </ShimmerProvider>,
  );
}

test('nothing shows for the first 300 ms, so fast loads never flash', async () => {
  await renderLoading(<Skeleton height={20} width={100} testID="block" />);
  expect(screen.queryByTestId('block')).toBeNull();
  await act(async () => jest.advanceTimersByTime(299));
  expect(screen.queryByTestId('block')).toBeNull();
  await act(async () => jest.advanceTimersByTime(1));
  expect(screen.getByTestId('block')).toBeTruthy();
});

test('the group is announced once as "Loading"; blocks are hidden from screen readers', async () => {
  await renderLoading(<SkeletonRow />);
  await act(async () => jest.advanceTimersByTime(300));
  const group = screen.getByLabelText('Loading');
  expect(group.props.accessible).toBe(true);
});

test('text skeletons take the height of their text style', async () => {
  await renderLoading(<SkeletonText variant="title3" width={120} testID="text" />);
  await act(async () => jest.advanceTimersByTime(300));
  expect(StyleSheet.flatten(screen.getByTestId('text').props.style).height).toBe(
    typography.title3.lineHeight,
  );
});

test('the shimmer band is drawn normally and dropped with Reduce Motion', async () => {
  await renderLoading(<Skeleton height={20} width={100} />);
  await act(async () => jest.advanceTimersByTime(300));
  expect(screen.queryAllByTestId('shimmer-band').length).toBe(1);

  reduceMotion = true;
  await renderLoading(<Skeleton height={20} width={100} />);
  await act(async () => jest.advanceTimersByTime(300));
  expect(screen.queryAllByTestId('shimmer-band').length).toBe(0);
});
