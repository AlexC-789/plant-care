import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { StepDone, StepProgress, Text } from '@/ui';

let reduceMotion = false;
beforeEach(() => {
  reduceMotion = false;
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(async () => reduceMotion);
});
afterEach(() => jest.restoreAllMocks());

const flat = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style);

test('StepProgress says which step, with the earlier segments filled', async () => {
  await render(<StepProgress step={2} />);
  expect(screen.getByRole('progressbar', { name: 'Step 2 of 4' })).toBeTruthy();
  const filled = [1, 2, 3, 4].map((n) => screen.getByTestId(`segment-${n}`).props.accessibilityState.checked);
  expect(filled).toEqual([true, true, false, false]);
});

test('StepProgress current segment grows in, or starts filled with Reduce Motion', async () => {
  await render(<StepProgress step={3} />);
  expect(flat('fill-3').transform).toBeDefined();
  reduceMotion = true;
  await render(<StepProgress step={3} />);
  await act(async () => {});
  expect(screen.getAllByTestId('fill-3').every((f) => !StyleSheet.flatten(f.props.style).transform)).toBe(true);
});

test('StepDone shows title and content', async () => {
  await render(
    <StepDone title="Got it.">
      <Text>extra</Text>
    </StepDone>,
  );
  expect(screen.getByText('Got it.')).toBeTruthy();
  expect(screen.getByText('extra')).toBeTruthy();
});

test('StepDone enters with opacity only under Reduce Motion', async () => {
  await render(<StepDone title="Got it." />);
  expect(flat('done-icon').transform).toBeDefined();
  reduceMotion = true;
  await render(<StepDone title="Got it." />);
  await act(async () => {});
  expect(screen.getAllByTestId('done-icon').every((n) => !StyleSheet.flatten(n.props.style).transform)).toBe(true);
});

test('StepDone announces its title once on mount', async () => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  announce.mockClear(); // the jest setup mock also counts earlier tests' StepDones
  await render(<StepDone title="Got it." />);
  expect(announce).toHaveBeenCalledTimes(1);
  expect(announce).toHaveBeenCalledWith('Got it.');
});
