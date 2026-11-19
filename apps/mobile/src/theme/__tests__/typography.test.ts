import { fontFiles, fonts, typography } from '@/theme';

test('six sizes plus display, as DESIGN_SYSTEM §2', () => {
  const scale = Object.fromEntries(
    Object.entries(typography).map(([name, s]) => [name, [s.fontFamily, s.fontSize, s.lineHeight]]),
  );
  expect(scale).toEqual({
    display: [fonts.condensed, 40, 40],
    largeTitle: [fonts.condensed, 32, 34],
    title: [fonts.condensed, 21, 24],
    headline: [fonts.semiBold, 17, 22],
    body: [fonts.regular, 17, 24],
    subheadline: [fonts.regular, 15, 20],
    footnote: [fonts.regular, 13, 18],
  });
});

test('tracking is em × size in points', () => {
  expect(typography.display.letterSpacing).toBeCloseTo(-0.4);
  expect(typography.largeTitle.letterSpacing).toBeCloseTo(-0.16);
  expect(typography.footnote.letterSpacing).toBeCloseTo(0.065);
});

test('every family has a bundled font file', () => {
  expect(Object.keys(fontFiles).sort()).toEqual(Object.values(fonts).sort());
});
