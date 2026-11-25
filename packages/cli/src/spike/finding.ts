import {
  ruleCatalog,
  ruleDocsUrl,
  type ChevronFinding,
  type RuleCatalogEntry,
} from 'eslint-plugin-chevron';

export type { ChevronFinding };

export type FindingInput = {
  readonly ruleId: string;
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly message: string;
  readonly fix: string;
  readonly source: string;
};

export function createFinding(input: FindingInput): ChevronFinding {
  const entry = ruleCatalog.find((candidate: RuleCatalogEntry) => candidate.id === input.ruleId);
  return {
    ...input,
    slug: entry?.slug ?? 'unmapped',
    docs: entry === undefined ? '' : ruleDocsUrl(entry),
  };
}

export function formatText(finding: ChevronFinding): string {
  return `${finding.file}:${String(finding.line)}:${String(finding.column)} ${finding.ruleId} ${finding.slug}: ${finding.message}. Fix: ${finding.fix}.`;
}

export function compareFindings(left: ChevronFinding, right: ChevronFinding): number {
  return (
    left.file.localeCompare(right.file) ||
    left.line - right.line ||
    left.column - right.column ||
    left.ruleId.localeCompare(right.ruleId)
  );
}
