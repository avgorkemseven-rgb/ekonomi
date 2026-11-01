// Root ESLint flat config, shared by every workspace package (ESLint resolves it upward from cwd).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**', '**/.next/**', '**/.expo/**', '**/node_modules/**', '**/coverage/**',
      '**/next-env.d.ts', '**/*.config.js', '**/*.config.mjs', '**/babel.config.js', '**/metro.config.js',
      '**/playwright-report/**', '**/test-results/**', '**/.data/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports', disallowTypeAnnotations: false }],
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    },
  },
  {
    // NestJS relies on runtime class references for DI; type-only import rewriting breaks emitDecoratorMetadata.
    files: ['apps/api/**/*.ts'],
    rules: { '@typescript-eslint/consistent-type-imports': 'off' },
  },
  {
    files: ['**/*.cjs', '**/scripts/**/*.js'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
);
