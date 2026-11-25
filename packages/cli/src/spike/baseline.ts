import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import { createFinding, type ChevronFinding } from './finding.js';

/** One baseline entry per rule and file (RULES.md, CHV091 draft). */
export type BaselineEntry = {
  readonly ruleId: string;
  readonly file: string;
  readonly count: number;
};

export type BaselineOutcome = {
  /** Findings that are not covered by the baseline (fail the check). */
  readonly findings: ChevronFinding[];
  /** Number of findings tolerated by the baseline. */
  readonly suppressed: number;
};

const key = (ruleId: string, file: string): string => `${ruleId}\u0000${file}`;

function countFindings(findings: readonly ChevronFinding[]): Map<string, BaselineEntry> {
  const counts = new Map<string, BaselineEntry>();
  for (const finding of findings) {
    if (finding.ruleId === 'CHV090' || finding.ruleId === 'CHV091') {
      continue; // Directives and the baseline itself are never baselined.
    }
    const id = key(finding.ruleId, finding.file);
    counts.set(id, {
      ruleId: finding.ruleId,
      file: finding.file,
      count: (counts.get(id)?.count ?? 0) + 1,
    });
  }
  return counts;
}

function isEntry(value: unknown): value is BaselineEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ruleId' in value &&
    typeof value.ruleId === 'string' &&
    'file' in value &&
    typeof value.file === 'string' &&
    'count' in value &&
    typeof value.count === 'number'
  );
}

export function readBaseline(baselinePath: string): BaselineEntry[] {
  if (!existsSync(baselinePath)) {
    return [];
  }
  const parsed: unknown = JSON.parse(readFileSync(baselinePath, 'utf8'));
  return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
}

export function writeBaseline(baselinePath: string, entries: readonly BaselineEntry[]): void {
  const sorted = [...entries].sort(
    (left: BaselineEntry, right: BaselineEntry) =>
      left.file.localeCompare(right.file) || left.ruleId.localeCompare(right.ruleId),
  );
  writeFileSync(baselinePath, `${JSON.stringify(sorted, null, 2)}\n`);
}

/** Initial adoption: record everything. Only allowed when no baseline exists yet. */
export function createBaseline(findings: readonly ChevronFinding[]): BaselineEntry[] {
  return [...countFindings(findings).values()];
}

/** Ratchet: lower counts / drop entries to the current state, never raise or add. */
export function pruneBaseline(
  entries: readonly BaselineEntry[],
  findings: readonly ChevronFinding[],
): BaselineEntry[] {
  const current = countFindings(findings);
  return entries
    .map((entry: BaselineEntry): BaselineEntry => ({
      ...entry,
      count: Math.min(entry.count, current.get(key(entry.ruleId, entry.file))?.count ?? 0),
    }))
    .filter((entry: BaselineEntry) => entry.count > 0);
}

/**
 * CHV091: findings in a (rule, file) group up to the baseline count are tolerated. A group above
 * its count fails with all of its findings plus a CHV091 finding; a group below its count fails
 * with a CHV091 finding, because an unpruned baseline could silently absorb a later regression.
 */
export function applyBaseline(
  entries: readonly BaselineEntry[],
  findings: readonly ChevronFinding[],
): BaselineOutcome {
  const allowed = new Map(
    entries.map((entry: BaselineEntry) => [key(entry.ruleId, entry.file), entry.count]),
  );
  const current = countFindings(findings);
  const remaining: ChevronFinding[] = [];
  let suppressed = 0;
  for (const finding of findings) {
    const id = key(finding.ruleId, finding.file);
    const limit = allowed.get(id) ?? 0;
    const actual = current.get(id)?.count ?? 0;
    if (actual > 0 && actual <= limit) {
      suppressed += 1;
    } else {
      remaining.push(finding);
    }
  }
  for (const entry of entries) {
    const actual = current.get(key(entry.ruleId, entry.file))?.count ?? 0;
    if (actual === entry.count) {
      continue;
    }
    remaining.push(
      createFinding({
        ruleId: 'CHV091',
        file: entry.file,
        line: 1,
        column: 1,
        message:
          actual > entry.count
            ? `'chevron-baseline.json' grew for ${entry.ruleId} in '${entry.file}' (${String(entry.count)} -> ${String(actual)})`
            : `'chevron-baseline.json' is stale for ${entry.ruleId} in '${entry.file}' (${String(entry.count)} -> ${String(actual)})`,
        fix:
          actual > entry.count
            ? 'Fix the new violation; the baseline may only shrink'
            : "Run 'chevron baseline --prune' and commit the smaller baseline",
        source: 'chevron-cli',
      }),
    );
  }
  return { findings: remaining, suppressed };
}
