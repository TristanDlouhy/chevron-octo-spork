import { existsSync } from 'node:fs';
import path from 'node:path';

import {
  applyBaseline,
  createBaseline,
  pruneBaseline,
  readBaseline,
  writeBaseline,
} from './baseline.js';
import { runEslintEngine } from './eslint-engine.js';
import { compareFindings, type ChevronFinding } from './finding.js';
import { checkModuleLayout } from './module-layout.js';
import { runTsMorphEngine } from './ts-morph-engine.js';

export type Engine = 'eslint' | 'ts-morph';

export type CheckReport = {
  readonly engine: Engine;
  readonly durationMs: number;
  readonly suppressed: number;
  readonly findings: ChevronFinding[];
};

const MODULES_DIR = path.join('src', 'modules');
const BASELINE_FILE = 'chevron-baseline.json';

export function isEngine(value: string): value is Engine {
  return value === 'eslint' || value === 'ts-morph';
}

async function collect(projectDir: string, engine: Engine): Promise<ChevronFinding[]> {
  const perFile =
    engine === 'eslint'
      ? await runEslintEngine(projectDir, ['src/**/*.ts'])
      : runTsMorphEngine(projectDir);
  return [...perFile, ...checkModuleLayout(projectDir, MODULES_DIR)].sort(compareFindings);
}

export async function check(projectDirInput: string, engine: Engine): Promise<CheckReport> {
  const projectDir = path.resolve(projectDirInput);
  const started = performance.now();
  const findings = await collect(projectDir, engine);
  const outcome = applyBaseline(readBaseline(path.join(projectDir, BASELINE_FILE)), findings);
  return {
    engine,
    durationMs: Math.round(performance.now() - started),
    suppressed: outcome.suppressed,
    findings: outcome.findings.sort(compareFindings),
  };
}

/** `chevron baseline` creates the file once; `chevron baseline --prune` may only shrink it. */
export async function baseline(
  projectDirInput: string,
  engine: Engine,
  prune: boolean,
): Promise<string> {
  const projectDir = path.resolve(projectDirInput);
  const baselinePath = path.join(projectDir, BASELINE_FILE);
  const findings = await collect(projectDir, engine);
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
