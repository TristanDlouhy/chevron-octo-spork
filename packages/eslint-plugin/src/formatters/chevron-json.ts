import path from 'node:path';

import type { ESLint, Linter } from 'eslint';

import {
  findRuleByDelegate,
  ruleCatalog,
  ruleDocsUrl,
  type RuleCatalogEntry,
} from '../rule-catalog.js';

/** One finding in the Chevron JSON format (RULES.md, "Fehlermeldungsformat"). */
export type ChevronFinding = {
  readonly ruleId: string;
  readonly slug: string;
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly message: string;
  readonly fix: string;
  readonly docs: string;
  /** ESLint rule that produced the finding, for delegated rules. */
  readonly source: string;
};

const CHEVRON_MESSAGE = /^(CHV\d{3}) ([a-z0-9-]+): (.*?)\. Fix: (.*?)\.?$/;

function findEntry(eslintRuleId: string | null): RuleCatalogEntry | undefined {
  if (eslintRuleId === null) {
    // Unused or ignored inline directives are reported without a rule id (CHV090).
    return ruleCatalog.find((entry: RuleCatalogEntry) => entry.id === 'CHV090');
  }
  const chevronMatch = /^chevron\/(chv\d{3})$/.exec(eslintRuleId);
  if (chevronMatch?.[1] !== undefined) {
    const id = chevronMatch[1].toUpperCase();
    return ruleCatalog.find((entry: RuleCatalogEntry) => entry.id === id);
  }
  return findRuleByDelegate(eslintRuleId);
}

export function toChevronFindings(
  results: readonly ESLint.LintResult[],
  cwd: string,
): ChevronFinding[] {
  return results.flatMap((result: ESLint.LintResult) =>
    result.messages.map((message: Linter.LintMessage): ChevronFinding => {
      const entry = findEntry(message.ruleId);
      const parsed = CHEVRON_MESSAGE.exec(message.message);
      return {
        ruleId: entry?.id ?? 'CHV???',
        slug: entry?.slug ?? 'unmapped',
        file: path.relative(cwd, result.filePath),
        line: message.line,
        column: message.column,
        message: parsed?.[3] ?? message.message.replace(/\.$/, ''),
        fix: parsed?.[4] ?? entry?.fix ?? '',
        docs: entry === undefined ? '' : ruleDocsUrl(entry),
        source: message.ruleId ?? 'eslint',
      };
    }),
  );
}

/** ESLint formatter: `eslint -f ./node_modules/eslint-plugin-chevron/dist/formatters/chevron-json.js`. */
export default function format(results: readonly ESLint.LintResult[]): string {
  return JSON.stringify(toChevronFindings(results, process.cwd()), null, 2);
}
