import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import i18next from 'eslint-plugin-i18next';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['**/test-results/', '**/playwright-report/', '**/dist/', '**/node_modules/', '**/coverage/', '.claude/', '.codegraph/', '.superpowers/']),
  js.configs.recommended,
  tseslint.configs.recommended,
  { rules: { '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }] } },
  {
    files: ['apps/web/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: ['firebase/firestore', 'firebase/storage', 'firebase-admin', 'firebase/analytics', '@vercel/analytics', 'posthog-js'],
          patterns: [
            'firebase/firestore/*',
            'firebase/storage/*',
            'firebase-admin/*',
            '@google-cloud/*',
            'react-ga*',
            '@sentry/*',
            '**/packages/domain/fixtures/*',
            '@logina/domain',
          ],
        },
      ],
    },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': ['error', { mode: 'jsx-text-only' }],
      'no-restricted-syntax': [
        'error',
        { selector: 'Literal[value=/(^|\\s)[a-z:-]+-\\[/]', message: 'Use design tokens, not arbitrary Tailwind values.' },
        { selector: 'TemplateElement[value.raw=/(^|\\s)[a-z:-]+-\\[/]', message: 'Use design tokens, not arbitrary Tailwind values.' },
      ],
    },
  },
]);
