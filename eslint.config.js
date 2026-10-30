import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['**/dist/', '**/node_modules/', '**/coverage/', '.claude/', '.codegraph/', '.superpowers/']),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['apps/web/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: ['firebase/firestore', 'firebase/storage', 'firebase-admin'],
          patterns: ['firebase/firestore/*', 'firebase/storage/*', 'firebase-admin/*', '@google-cloud/*'],
        },
      ],
    },
  },
]);
