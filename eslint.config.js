import { chevron } from 'eslint-plugin-chevron';

export default [
  {
    ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', 'eslint.config.js'],
  },
  ...chevron.configs.recommended({
    tsconfigRootDir: import.meta.dirname,
    files: ['packages/*/src/**/*.ts', 'examples/*/src/**/*.ts'],
  }),
];
