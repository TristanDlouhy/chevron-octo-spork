/**
 * Single source of truth for Chevron rule IDs. Mirrors the overview table in RULES.md.
 * IDs are stable: a retired ID is never reused.
 */

export type RuleCheck = 'eslint' | 'typescript-eslint' | 'cli' | 'config';

export type RuleStatus = 'active' | 'planned';

export type RuleCatalogEntry = {
  readonly id: `CHV${string}`;
  readonly slug: string;
  readonly summary: string;
  readonly checks: readonly RuleCheck[];
  readonly status: RuleStatus;
  /** typescript-eslint rules that implement this Chevron rule (without the '@typescript-eslint/' prefix). */
  readonly delegatesTo: readonly string[];
  /**
   * Fix instruction for findings whose message has no "Fix:" part: delegated typescript-eslint
   * rules and ESLint's own directive warnings (CHV090). Taken from the rule's message in RULES.md.
   */
  readonly fix?: string;
};

export const RULES_DOCS_URL =
  'https://github.com/TristanDlouhy/chevron-octo-spork/blob/main/RULES.md';

export const ruleCatalog = [
  {
    id: 'CHV001',
    slug: 'strict-tsconfig',
    summary: 'tsconfig enables the fixed strict flag set.',
    checks: ['cli'],
    status: 'planned',
    delegatesTo: [],
  },
  {
    id: 'CHV002',
    slug: 'no-any',
    summary: "No 'any', explicit or through unsafe values.",
    checks: ['typescript-eslint'],
    status: 'active',
    delegatesTo: [
      'no-explicit-any',
      'no-unsafe-argument',
      'no-unsafe-assignment',
      'no-unsafe-call',
      'no-unsafe-member-access',
      'no-unsafe-return',
    ],
    fix: "Use 'unknown' and narrow with a type guard",
  },
  {
    id: 'CHV003',
    slug: 'no-type-escape',
    summary: "No type assertions (except 'as const') and no non-null assertions.",
    checks: ['typescript-eslint'],
    status: 'active',
    delegatesTo: ['consistent-type-assertions', 'no-non-null-assertion'],
    fix: "Narrow with a type guard that returns 'value is T'",
  },
  {
    id: 'CHV004',
    slug: 'no-ts-directives',
    summary: 'No @ts-ignore, @ts-expect-error, @ts-nocheck, @ts-check.',
    checks: ['typescript-eslint'],
    status: 'active',
    delegatesTo: ['ban-ts-comment'],
    fix: 'Fix the type error; wrap untyped third-party code in an adapter',
  },
  {
    id: 'CHV005',
    slug: 'explicit-boundary-types',
    summary: 'Exported functions and class methods declare their types.',
    checks: ['typescript-eslint'],
    status: 'active',
    delegatesTo: ['explicit-module-boundary-types', 'explicit-function-return-type'],
    fix: 'Declare the return type explicitly',
  },
  {
    id: 'CHV010',
    slug: 'module-layout',
    summary: 'Fixed directory and file layout per module.',
    checks: ['cli'],
    status: 'planned',
    delegatesTo: [],
  },
  {
    id: 'CHV011',
    slug: 'file-naming',
    summary: 'kebab-case file names with a fixed suffix per layer.',
    checks: ['eslint'],
    status: 'planned',
    delegatesTo: [],
  },
  {
    id: 'CHV012',
    slug: 'declaration-naming',
    summary: 'Main declaration name follows from the file name.',
    checks: ['eslint'],
    status: 'planned',
    delegatesTo: [],
  },
  {
    id: 'CHV013',
    slug: 'no-default-export',
    summary: 'Named exports only.',
    checks: ['eslint'],
    status: 'planned',
    delegatesTo: [],
  },
  {
    id: 'CHV014',
    slug: 'single-barrel',
    summary: 'index.ts only at the module root, re-exports only.',
    checks: ['cli'],
    status: 'planned',
    delegatesTo: [],
  },
  {
    id: 'CHV020',
    slug: 'one-contract-one-impl',
    summary: 'Exactly one interface and one implementation per service/use case.',
    checks: ['cli', 'eslint'],
    status: 'planned',
    delegatesTo: [],
  },
  {
    id: 'CHV021',
    slug: 'no-inheritance',
    summary: "No 'extends' on classes or contracts, no 'abstract'.",
    checks: ['eslint'],
    status: 'planned',
    delegatesTo: [],
  },
  {
    id: 'CHV022',
    slug: 'interface-for-contracts-only',
    summary: "'interface' only for contracts; data is 'type'.",
    checks: ['eslint'],
    status: 'planned',
    delegatesTo: [],
  },
  {
    id: 'CHV023',
    slug: 'use-case-shape',
    summary: "A use case has exactly one method 'execute(input)'.",
    checks: ['eslint'],
    status: 'planned',
    delegatesTo: [],
  },
  {
    id: 'CHV024',
    slug: 'constructor-injection',
    summary: 'Dependencies only via constructor, typed as contracts.',
    checks: ['eslint'],
    status: 'planned',
    delegatesTo: [],
  },
  {
    id: 'CHV025',
    slug: 'impl-only-in-composition-root',
    summary: '*.impl.ts is imported only by the composition root and tests.',
    checks: ['eslint'],
    status: 'planned',
    delegatesTo: [],
  },
  {
    id: 'CHV030',
    slug: 'layer-imports',
    summary: 'Fixed import matrix between layers.',
    checks: ['eslint'],
    status: 'planned',
    delegatesTo: [],
  },
  {
    id: 'CHV031',
    slug: 'module-public-api',
    summary: 'Other modules only via their index.ts.',
    checks: ['eslint'],
    status: 'planned',
    delegatesTo: [],
  },
  {
    id: 'CHV032',
    slug: 'no-cycles',
    summary: 'No import cycles between files or modules.',
    checks: ['cli'],
    status: 'planned',
    delegatesTo: [],
  },
  {
    id: 'CHV033',
    slug: 'pure-core',
    summary: 'npm packages and Node builtins only in adapters.',
    checks: ['eslint'],
    status: 'planned',
    delegatesTo: [],
  },
  {
    id: 'CHV040',
    slug: 'no-throw-in-core',
    summary: "No 'throw' outside adapters.",
    checks: ['eslint'],
    status: 'planned',
    delegatesTo: [],
  },
  {
    id: 'CHV041',
    slug: 'try-catch-only-in-adapters',
    summary: "'try'/'catch' only in adapters.",
    checks: ['eslint'],
    status: 'planned',
    delegatesTo: [],
  },
  {
    id: 'CHV042',
    slug: 'result-return',
    summary: 'Contract methods return a Result type.',
    checks: ['eslint'],
    status: 'planned',
    delegatesTo: [],
  },
  {
    id: 'CHV043',
    slug: 'tagged-errors',
    summary: "Error types are objects with a literal 'type' field.",
    checks: ['eslint'],
    status: 'planned',
    delegatesTo: [],
  },
  {
    id: 'CHV090',
    slug: 'no-inline-config',
    summary: 'No eslint-disable comments.',
    checks: ['config', 'cli'],
    status: 'active',
    delegatesTo: [],
    fix: 'Remove the directive and fix the violation; exceptions belong in chevron.config with a reason',
  },
  {
    id: 'CHV091',
    slug: 'baseline-ratchet',
    summary: 'The baseline may only shrink.',
    checks: ['cli'],
    status: 'planned',
    delegatesTo: [],
  },
] as const satisfies readonly RuleCatalogEntry[];

export type ChevronRuleId = (typeof ruleCatalog)[number]['id'];

/** Maps a typescript-eslint rule name (e.g. '@typescript-eslint/no-explicit-any') to its Chevron rule. */
export function findRuleByDelegate(eslintRuleName: string): RuleCatalogEntry | undefined {
  const bareName = eslintRuleName.replace(/^@typescript-eslint\//, '');
  return ruleCatalog.find((entry: RuleCatalogEntry) => entry.delegatesTo.includes(bareName));
}

export function ruleDocsUrl(entry: RuleCatalogEntry): string {
  return `${RULES_DOCS_URL}#${entry.id.toLowerCase()}`;
}
