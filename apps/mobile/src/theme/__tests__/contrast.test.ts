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

  test('text on the ink button is readable', () => {
    expect(contrastRatio(c.onTint, c.tint)).toBeGreaterThanOrEqual(4.5);
  });

  test('buttons are ink, not a brand colour', () => {
    expect(c.tint).toBe(c.label);
  });
});

// The light water line (1.7:1) is soft on purpose and always paired with words (DESIGN_SYSTEM §1).
test('dark water line stands out from its track (≥ 3:1)', () => {
  expect(contrastRatio(colors.dark.water, colors.dark.waterFill)).toBeGreaterThanOrEqual(3);
});

test('colour values match the Direction E table (DESIGN_SYSTEM §1)', () => {
  expect(colors.light).toEqual({
    background: '#F5F5F3', surface: '#FFFFFF', label: '#1F1F1F', secondaryLabel: '#66655F',
    separator: '#E3E3E0', waterFill: '#D9D8D4', water: '#5FAEE3', statusNow: '#D0213B',
    tint: '#1F1F1F', onTint: '#FFFFFF', skeleton: '#ECEBE8', skeletonHighlight: '#F5F5F3',
  });
  expect(colors.dark).toEqual({
    background: '#161616', surface: '#222221', label: '#F2F2F0', secondaryLabel: '#A3A29C',
    separator: '#2E2E2C', waterFill: '#3A3A38', water: '#7CC0EE', statusNow: '#FF5C70',
    tint: '#F2F2F0', onTint: '#161616', skeleton: '#262625', skeletonHighlight: '#2E2E2C',
  });
});
