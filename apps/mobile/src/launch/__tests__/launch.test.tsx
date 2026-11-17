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
  test('fades out only when both the animation has finished and the session is known', async () => {
    const { result, rerender } = await renderHook(
      ({ loading }: { loading: boolean }) => useLaunchGate(loading),
      { initialProps: { loading: true } },
    );
    expect(result.current).toMatchObject({ mounted: true, fadingOut: false });
    await act(async () => result.current.onAnimationDone());
    expect(result.current.fadingOut).toBe(false); // session still loading: hold
    await rerender({ loading: false });
    expect(result.current).toMatchObject({ mounted: true, fadingOut: true });
    await act(async () => result.current.onExited());
    expect(result.current.mounted).toBe(false);
  });

  test('a fast session still waits for the animation', async () => {
    const { result } = await renderHook(() => useLaunchGate(false));
    expect(result.current.fadingOut).toBe(false);
    await act(async () => result.current.onAnimationDone());
    expect(result.current.fadingOut).toBe(true);
  });

  test('plays once per app run (not again when the root remounts)', async () => {
    const first = await renderHook(() => useLaunchGate(false));
    await act(async () => first.result.current.onAnimationDone());
    await act(async () => first.result.current.onExited());
    const second = await renderHook(() => useLaunchGate(false));
    expect(second.result.current.mounted).toBe(false);
  });
});

describe('LaunchAnimation', () => {
  test('draws, rests on the finished drawing ~500 ms, then reports done (~1.2 s)', async () => {
    expect(LAUNCH_DURATION_MS).toBe(1200);
    const onDone = jest.fn();
    await render(<LaunchAnimation onDone={onDone} />);
    await act(async () => jest.advanceTimersByTime(1100));
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

  test('fading out animates to transparent, then reports exited', async () => {
    const onExited = jest.fn();
    const view = await render(<LaunchAnimation onDone={() => {}} fadingOut={false} onExited={onExited} />);
    await act(async () => jest.advanceTimersByTime(LAUNCH_DURATION_MS + 50));
    await view.rerender(<LaunchAnimation onDone={() => {}} fadingOut onExited={onExited} />);
    await act(async () => jest.advanceTimersByTime(100));
    expect(onExited).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(200));
    expect(onExited).toHaveBeenCalledTimes(1);
  });

  test('hides the native splash once its first frame is laid out', async () => {
    const onReady = jest.fn();
    const view = await render(<LaunchAnimation onDone={() => {}} onReady={onReady} />);
    expect(onReady).not.toHaveBeenCalled();
    await act(async () => {
      view.getByTestId('launch').props.onLayout({ nativeEvent: { layout: { width: 390, height: 844 } } });
    });
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  test('is labelled with the app name for screen readers', async () => {
    const view = await render(<LaunchAnimation onDone={() => {}} />);
    expect(view.getByLabelText('Plant Care')).toBeTruthy();
  });
});
