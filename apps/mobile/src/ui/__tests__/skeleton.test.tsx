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
  await renderLoading(<SkeletonText variant="title" width={120} testID="text" />);
  await act(async () => jest.advanceTimersByTime(300));
  expect(StyleSheet.flatten(screen.getByTestId('text').props.style).height).toBe(
    typography.title.lineHeight,
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

describe('shimmer only runs while a skeleton is on screen', () => {
  test('no loop without skeletons; starts with one; stops when the last unmounts', async () => {
    const { Animated } = jest.requireActual('react-native');
    const stop = jest.fn();
    const start = jest.fn();
    const loop = jest.spyOn(Animated, 'loop').mockReturnValue({ start, stop, reset: jest.fn() });
    const view = await render(
      <ShimmerProvider>
        <></>
      </ShimmerProvider>,
    );
    await act(async () => {});
    expect(start).not.toHaveBeenCalled();

    await view.rerender(
      <ShimmerProvider>
        <Skeleton height={10} width={50} />
      </ShimmerProvider>,
    );
    await act(async () => {});
    expect(start).toHaveBeenCalledTimes(1);

    await view.rerender(
      <ShimmerProvider>
        <></>
      </ShimmerProvider>,
    );
    await act(async () => {});
    expect(stop).toHaveBeenCalled();
    loop.mockRestore();
  });
});

describe('FadeIn', () => {
  test('content fades in over 150 ms', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded after spies
    const { FadeIn } = require('@/ui');
    await render(
      <FadeIn testID="fade">
        <></>
      </FadeIn>,
    );
    await act(async () => {});
    expect(StyleSheet.flatten(screen.getByTestId('fade').props.style).opacity).toBe(0);
    await act(async () => jest.advanceTimersByTime(200));
    expect(StyleSheet.flatten(screen.getByTestId('fade').props.style).opacity).toBe(1);
  });

  test('with Reduce Motion content appears at once', async () => {
    reduceMotion = true;
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded after spies
    const { FadeIn } = require('@/ui');
    await render(
      <FadeIn testID="fade">
        <></>
      </FadeIn>,
    );
    await act(async () => {});
    expect(StyleSheet.flatten(screen.getByTestId('fade').props.style).opacity).toBe(1);
  });
});
