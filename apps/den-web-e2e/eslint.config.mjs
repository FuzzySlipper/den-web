import playwright from 'eslint-plugin-playwright';
import baseConfig from '../../eslint.config.mjs';

export default [
  playwright.configs['flat/recommended'],
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.js'],
    rules: {},
  },
  {
    files: ['**/src/live/**/*.ts'],
    rules: {
      'playwright/no-skipped-test': 'off',
    },
  },
];
