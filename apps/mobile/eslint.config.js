// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*'],
  },
  {
    // Colours come only from the theme (src/theme/colors.ts).
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/theme/**', '**/__tests__/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/^#(?:[0-9a-fA-F]{3,4}){1,2}$/]',
          message: 'Use a theme colour token (useTheme().colors) instead of a raw colour.',
        },
        {
          selector: 'Literal[value=/^(rgb|hsl)a?\\(/]',
          message: 'Use a theme colour token (useTheme().colors) instead of a raw colour.',
        },
      ],
    },
  },
]);
