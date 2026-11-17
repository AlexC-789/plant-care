import { act, render, renderHook } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { LaunchAnimation, LAUNCH_DURATION_MS } from '@/launch/LaunchAnimation';
import { resetLaunchForTests, useLaunchGate } from '@/launch/useLaunchGate';

let reduceMotion = false;
beforeEach(() => {
  jest.useFakeTimers();
  reduceMotion = false;
  resetLaunchForTests();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(async () => reduceMotion);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('useLaunchGate', () => {
  test('shows until both the animation has finished and the session is known', async () => {
    const { result, rerender } = await renderHook(
      ({ loading }: { loading: boolean }) => useLaunchGate(loading),
      { initialProps: { loading: true } },
    );
    expect(result.current.showLaunch).toBe(true);
    await act(async () => result.current.onAnimationDone());
    expect(result.current.showLaunch).toBe(true); // session still loading: hold
    await rerender({ loading: false });
    expect(result.current.showLaunch).toBe(false);
  });

  test('a fast session still waits for the animation', async () => {
    const { result } = await renderHook(() => useLaunchGate(false));
    expect(result.current.showLaunch).toBe(true);
    await act(async () => result.current.onAnimationDone());
    expect(result.current.showLaunch).toBe(false);
  });

  test('plays once per app run (not again when the root remounts)', async () => {
    const first = await renderHook(() => useLaunchGate(false));
    await act(async () => first.result.current.onAnimationDone());
    const second = await renderHook(() => useLaunchGate(false));
    expect(second.result.current.showLaunch).toBe(false);
  });
});

describe('LaunchAnimation', () => {
  test('draws for about 700 ms, then reports done', async () => {
    const onDone = jest.fn();
    await render(<LaunchAnimation onDone={onDone} />);
    await act(async () => jest.advanceTimersByTime(LAUNCH_DURATION_MS - 100));
    expect(onDone).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(200));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  test('with Reduce Motion it only fades, about 300 ms', async () => {
    reduceMotion = true;
    const onDone = jest.fn();
    await render(<LaunchAnimation onDone={onDone} />);
    await act(async () => jest.advanceTimersByTime(350));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  test('is labelled with the app name for screen readers', async () => {
    const view = await render(<LaunchAnimation onDone={() => {}} />);
    expect(view.getByLabelText('Plant Care')).toBeTruthy();
  });
});
