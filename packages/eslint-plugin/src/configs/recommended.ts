import type { Linter } from 'eslint';
import tseslint from 'typescript-eslint';

/**
 * Rules that Chevron delegates to typescript-eslint, with fixed options.
 * Keep in sync with `delegatesTo` in rule-catalog.ts.
 */
const delegatedRules: Linter.RulesRecord = {
  // CHV002 no-any
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-unsafe-argument': 'error',
  '@typescript-eslint/no-unsafe-assignment': 'error',
  '@typescript-eslint/no-unsafe-call': 'error',
  '@typescript-eslint/no-unsafe-member-access': 'error',
  '@typescript-eslint/no-unsafe-return': 'error',
  // CHV003 no-type-escape ('as const' stays allowed)
  '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
  '@typescript-eslint/no-non-null-assertion': 'error',
  // CHV004 no-ts-directives
  '@typescript-eslint/ban-ts-comment': [
    'error',
    {
      'ts-check': true,
      'ts-expect-error': true,
      'ts-ignore': true,
      'ts-nocheck': true,
    },
  ],
  // CHV005 explicit-boundary-types
  '@typescript-eslint/explicit-module-boundary-types': 'error',
  '@typescript-eslint/explicit-function-return-type': [
    'error',
    { allowExpressions: true, allowTypedFunctionExpressions: true },
  ],
};

export type RecommendedConfigOptions = {
  /** Directory used as root for typed linting (usually `import.meta.dirname` of eslint.config.js). */
  readonly tsconfigRootDir: string;
  /** Glob patterns of files that Chevron governs. Default: all TypeScript files. */
  readonly files?: readonly string[];
};

export function createRecommendedConfig(options: RecommendedConfigOptions): Linter.Config[] {
  const files = options.files ?? ['**/*.ts', '**/*.mts', '**/*.cts'];
  return [
    {
      name: 'chevron/recommended',
      files: [...files],
      languageOptions: {
        parser: tseslint.parser,
        parserOptions: {
          projectService: true,
          tsconfigRootDir: options.tsconfigRootDir,
        },
      },
      plugins: {
        '@typescript-eslint': tseslint.plugin,
      },
      // CHV090 no-inline-config
      linterOptions: {
        noInlineConfig: true,
        reportUnusedDisableDirectives: 'error',
      },
      rules: delegatedRules,
    },
  ];
}
