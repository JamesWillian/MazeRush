/* eslint-env node */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/strict',
    'prettier',
  ],
  env: {
    es2022: true,
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    '@typescript-eslint/no-non-null-assertion': 'error',
    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    eqeqeq: ['error', 'always'],
  },
  overrides: [
    {
      files: ['**/*.test.ts'],
      rules: {
        '@typescript-eslint/no-non-null-assertion': 'off',
      },
    },
    {
      files: ['apps/client/**/*.ts'],
      env: { browser: true },
    },
    {
      files: ['apps/server/**/*.ts'],
      env: { node: true },
    },
  ],
  ignorePatterns: ['dist', 'node_modules', 'coverage', '*.cjs', '*.config.ts', '*.config.js'],
};
