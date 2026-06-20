import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import sonarjs from 'eslint-plugin-sonarjs'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'node_modules', 'apps/**/*.test.ts', 'apps/**/*.test.tsx', 'packages/**/*.test.ts', 'packages/**/*.test.tsx']),
  {
    files: ['apps/**/*.{ts,tsx}', 'packages/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      'react-hooks': reactHooks,
      sonarjs,
    },
    rules: {
      'max-lines-per-function': ['error', {
        max: 120,
        skipBlankLines: true,
        skipComments: true,
      }],
      'sonarjs/cognitive-complexity': ['error', 15],
    },
  },
])
