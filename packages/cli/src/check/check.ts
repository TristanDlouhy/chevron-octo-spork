import { existsSync } from 'node:fs';
import path from 'node:path';

import {
  applyBaseline,
  createBaseline,
  pruneBaseline,
  readBaseline,
  writeBaseline,
} from './baseline.js';
import { checkContractPairs } from './contract-pairs.js';
import { runEslint } from './run-eslint.js';
import { compareFindings, type ChevronFinding } from './finding.js';
import { checkModuleLayout } from './module-layout.js';

export type CheckReport = {
  readonly durationMs: number;
  readonly suppressed: number;
  readonly findings: ChevronFinding[];
};

const MODULES_DIR = path.join('src', 'modules');
const SOURCE_PATTERNS = ['src/**/*.ts'];
const BASELINE_FILE = 'chevron-baseline.json';

/** Per-file rules via ESLint (locked config), project-wide rules on the file system (ADR 0002). */
async function collect(projectDir: string): Promise<ChevronFinding[]> {
  return [
    ...(await runEslint(projectDir, SOURCE_PATTERNS)),
    ...checkModuleLayout(projectDir, MODULES_DIR),
    ...checkContractPairs(projectDir, MODULES_DIR),
  ].sort(compareFindings);
}

export async function check(projectDirInput: string): Promise<CheckReport> {
  const projectDir = path.resolve(projectDirInput);
  const started = performance.now();
  const findings = await collect(projectDir);
  const outcome = applyBaseline(readBaseline(path.join(projectDir, BASELINE_FILE)), findings);
  return {
    durationMs: Math.round(performance.now() - started),
    suppressed: outcome.suppressed,
    findings: outcome.findings.sort(compareFindings),
  };
}

/** `chevron baseline` creates the file once; `chevron baseline --prune` may only shrink it. */
export async function baseline(projectDirInput: string, prune: boolean): Promise<string> {
  const projectDir = path.resolve(projectDirInput);
  const baselinePath = path.join(projectDir, BASELINE_FILE);
  const findings = await collect(projectDir);
  if (prune) {
    writeBaseline(baselinePath, pruneBaseline(readBaseline(baselinePath), findings));
    return `Pruned ${BASELINE_FILE}.`;
  }
  if (existsSync(baselinePath)) {
    return `${BASELINE_FILE} exists. Use --prune; the baseline may only shrink (CHV091).`;
  }
  writeBaseline(baselinePath, createBaseline(findings));
  return `Created ${BASELINE_FILE}.`;
}
