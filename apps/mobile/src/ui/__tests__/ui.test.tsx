import { fireEvent, render, screen } from '@testing-library/react-native';
import * as RN from 'react-native';
import { StyleSheet } from 'react-native';

import { colors, resetAppearanceForTests, typography } from '@/theme';
import { Button, Icon, InsetGroup, PotDrawing, Row, Text } from '@/ui';

jest.mock('expo-symbols', () => ({
  SymbolView: jest.fn(() => null),
}));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 390, height: 844, scale: 3, fontScale: 1 })),
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports -- mocked modules above
const { SymbolView } = require('expo-symbols') as { SymbolView: jest.Mock };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const useWindowDimensions: jest.Mock = require('react-native/Libraries/Utilities/useWindowDimensions').default;

const flat = (el: { props: { style?: unknown } }) => StyleSheet.flatten(el.props.style as never) ?? {};

beforeEach(() => {
  SymbolView.mockClear();
  resetAppearanceForTests('light');
});
afterEach(() => jest.restoreAllMocks());

describe('Text', () => {
  test('applies the variant and token colour, following dark mode', async () => {
    resetAppearanceForTests('dark');
    await render(<Text variant="title">Plants</Text>);
    const style = flat(screen.getByText('Plants'));
    expect(style.fontSize).toBe(typography.title.fontSize);
    expect(style.color).toBe(colors.dark.label);
  });

  test('never caps font scaling', async () => {
    await render(<Text>Body</Text>);
    const el = screen.getByText('Body');
    expect(el.props.maxFontSizeMultiplier).toBeUndefined();
    expect(el.props.allowFontScaling).not.toBe(false);
  });
});

describe('Button', () => {
  test('prominent: tint background, onTint label, pressable', async () => {
    const onPress = jest.fn();
    await render(<Button label="Sign in" onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Sign in' });
    expect(flat(button).backgroundColor).toBe(colors.light.tint);
    expect(flat(screen.getByText('Sign in')).color).toBe(colors.light.onTint);
    expect(flat(button).minHeight).toBeGreaterThanOrEqual(44);
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalled();
  });

  test('disabled and busy are exposed and block presses', async () => {
    const onPress = jest.fn();
    await render(<Button label="Resend" variant="bordered" onPress={onPress} disabled busy />);
    const button = screen.getByRole('button', { name: 'Resend' });
    expect(button).toBeDisabled();
    expect(button.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  test('plain destructive uses statusNow', async () => {
    await render(<Button label="Sign out" variant="plain" destructive onPress={() => {}} />);
    expect(flat(screen.getByText('Sign out')).color).toBe(colors.light.statusNow);
  });
});

describe('Row and InsetGroup', () => {
  test('checkmark row is selected and shows the check icon', async () => {
    await render(
      <InsetGroup header="Units">
        <Row label="Automatic" accessory="checkmark" onPress={() => {}} />
      </InsetGroup>,
    );
    expect(screen.getByText('Units')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Automatic' })).toBeSelected();
    expect(SymbolView).toHaveBeenCalledWith(
      expect.objectContaining({ name: expect.objectContaining({ ios: 'checkmark' }) }),
      undefined,
    );
  });

  test('value sits beside the label normally and below it at accessibility sizes', async () => {
    await render(<Row label="Email" value="maya@example.com" testID="row" />);
    expect(flat(screen.getByTestId('row')).flexDirection).toBe('row');
    useWindowDimensions.mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 3 });
    await render(<Row label="Email" value="maya@example.com" testID="row" />);
    expect(flat(screen.getByTestId('row')).flexDirection).toBe('column');
  });
});

test('custom row content stretches to full width when stacked', async () => {
  useWindowDimensions.mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 3 });
  await render(
    <Row label="Name">
      <RN.TextInput testID="field" />
    </Row>,
  );
  expect(flat(screen.getByTestId('field').parent as never).alignSelf).toBe('stretch');
  useWindowDimensions.mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 1 });
});

describe('Icon', () => {
  test('maps to SF Symbols on iOS and Material Symbols elsewhere', async () => {
    await render(<Icon name="account" />);
    expect(SymbolView).toHaveBeenCalledWith(
      expect.objectContaining({
        name: { ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' },
        size: 22,
        tintColor: colors.light.label,
      }),
      undefined,
    );
  });
});

describe('PotDrawing', () => {
  test('is labelled for screen readers', async () => {
    await render(<PotDrawing />);
    expect(
      screen.getByLabelText(
        'Drawing of a pot standing on the watering saucer, with the sensor stake in the soil',
      ),
    ).toBeTruthy();
  });
});
