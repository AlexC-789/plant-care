import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { colors, resetAppearanceForTests } from '@/theme';
import { TankBar, WaterLine } from '@/ui';

let reduceMotion = false;
beforeEach(() => {
  reduceMotion = false;
  resetAppearanceForTests('light');
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(async () => reduceMotion);
});
afterEach(() => jest.restoreAllMocks());

const hidden = { includeHiddenElements: true };
const flat = (id: string) => StyleSheet.flatten(screen.getByTestId(id, hidden).props.style);

describe('WaterLine', () => {
  test('water on the track, hidden from screen readers (its text says the same)', async () => {
    await render(<WaterLine level={0.7} low={false} />);
    expect(flat('water-line')).toMatchObject({ height: 4, borderRadius: 2, backgroundColor: colors.light.waterFill });
    expect(flat('water-fill').backgroundColor).toBe(colors.light.water);
    expect(screen.getByTestId('water-line', hidden).props.importantForAccessibility).toBe('no-hide-descendants');
  });

  test('low is red and never drawn at zero width', async () => {
    reduceMotion = true;
    await render(<WaterLine level={0} low />);
    await act(async () => {});
    expect(flat('water-fill').backgroundColor).toBe(colors.light.statusNow);
    expect(flat('water-fill').transform).toEqual([{ scaleX: 0.05 }]);
  });

  test('no reading draws the dashed line', async () => {
    await render(<WaterLine level={null} low={false} />);
    expect(screen.getByTestId('water-none', hidden)).toBeTruthy();
    expect(screen.queryByTestId('water-fill', hidden)).toBeNull();
  });
});

describe('TankBar', () => {
  test('labels the level to the nearest 50 ml and the tank size', async () => {
    await render(<TankBar ml={512} fullMl={705} low={false} />);
    expect(screen.getByText('About 500 ml')).toBeTruthy();
    expect(screen.getByText('of 705 ml')).toBeTruthy();
    expect(screen.getByLabelText('Tank, about 500 ml of 705 ml')).toBeTruthy();
    expect(flat('tank-bar')).toMatchObject({ height: 10, borderRadius: 5 });
  });

  test('low and unknown always keep their words', async () => {
    await render(<TankBar ml={30} fullMl={705} low />);
    expect(screen.getByText('Nearly empty')).toBeTruthy();
    await render(<TankBar ml={null} fullMl={705} low={false} />);
    expect(screen.getByText('No current reading')).toBeTruthy();
    expect(screen.getByTestId('water-none', hidden)).toBeTruthy();
  });
});
