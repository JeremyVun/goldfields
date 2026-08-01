import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'scratch/**', '.claude/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-fallthrough': 'error',
      'no-unreachable': 'error',
    },
  },
  {
    files: ['**/*.mjs'],
    languageOptions: { globals: { process: 'readonly', Buffer: 'readonly', console: 'readonly', URL: 'readonly' } },
  },
);
