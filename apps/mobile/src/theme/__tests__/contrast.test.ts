import { colors, contrastRatio } from '@/theme';

test('contrastRatio matches WCAG for black on white', () => {
  expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 2);
  expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 2);
});

describe.each(['light', 'dark'] as const)('%s theme', (scheme) => {
  const c = colors[scheme];

  test.each(['label', 'secondaryLabel', 'tint', 'statusNow'] as const)(
    '%s text is readable (≥ 4.5:1) on surface and background',
    (token) => {
      expect(contrastRatio(c[token], c.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(c[token], c.background)).toBeGreaterThanOrEqual(4.5);
    },
  );

  test('text on the tint button is readable', () => {
    expect(contrastRatio(c.onTint, c.tint)).toBeGreaterThanOrEqual(4.5);
  });

  test('banner text is readable on its fill', () => {
    expect(contrastRatio(c.label, c.nowFill)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(c.label, c.soonFill)).toBeGreaterThanOrEqual(4.5);
  });
});

test('colour values match the design table', () => {
  expect(colors.light).toMatchObject({
    background: '#F4F1EB', surface: '#FFFDF9', label: '#1D1B18', secondaryLabel: '#5E5950',
    separator: '#E3DDD3', tint: '#2E5B47', statusNow: '#A3392B', water: '#3F6A82',
  });
  expect(colors.dark).toMatchObject({
    background: '#161412', surface: '#221F1B', label: '#F2EEE7', secondaryLabel: '#B5AEA3',
    separator: '#3A352F', tint: '#8FC0A4', onTint: '#0F2419', statusNow: '#EF8A78',
  });
});
