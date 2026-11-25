/**
 * `chevron check` against the violations fixture (every planted violation, nothing more) and the
 * reference module (nothing). CHV005 is excluded from the planted list; it is a side effect of
 * the explicit 'any' parameter.
 */
import { cpSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { baseline, check } from '../src/check/check.js';
import type { ChevronFinding } from '../src/check/finding.js';

const here = import.meta.dirname;
const violations = path.join(here, 'fixtures', 'violations');
const reference = path.resolve(here, '..', '..', '..', 'examples', 'gate-registry');

const EXPECTED = [
  'CHV010 energy-budget:1',
  'CHV010 energy-budget/helpers:1',
  'CHV010 energy-budget/NOTES.md:1',
  'CHV021 energy-budget/ports/audit-log.port.ts:5',
  'CHV010 energy-budget/services/impl:1',
  'CHV020 energy-budget/services/impl/shadow.service.impl.ts:1',
  'CHV020 energy-budget/services/impl/shadow.service.impl.ts:1',
  'CHV020 energy-budget/services/reserve-energy.service.impl.ts:5',
  'CHV021 energy-budget/services/reserve-energy.service.impl.ts:6',
  'CHV002 energy-budget/services/reserve-energy.service.impl.ts:11',
  'CHV002 energy-budget/services/reserve-energy.service.impl.ts:12',
  'CHV002 energy-budget/services/reserve-energy.service.impl.ts:13',
  'CHV002 energy-budget/services/reserve-energy.service.impl.ts:13',
  'CHV020 energy-budget/services/reserve-energy.service.impl.ts:22',
  'CHV090 energy-budget/services/reserve-energy.service.impl.ts:23',
  'CHV002 energy-budget/services/reserve-energy.service.impl.ts:24',
  'CHV020 energy-budget/use-cases/plan-connection.use-case.ts:1',
  'CHV021 shield/services/shield-control.service.impl.ts:3',
  'CHV020 shield/use-cases/open-shield.use-case.impl.ts:1',
  'CHV020 shield/use-cases/open-shield.use-case.impl.ts:1',
  'CHV010 telemetry:1',
  'CHV010 telemetry:1',
  'CHV010 telemetry/README.md:1',
].sort();

function keys(findings: readonly ChevronFinding[]): string[] {
  return findings
    .filter((finding: ChevronFinding) => finding.ruleId !== 'CHV005')
    .map(
      (finding: ChevronFinding) =>
        `${finding.ruleId} ${finding.file.replace('src/modules/', '')}:${String(finding.line)}`,
    )
    .sort();
}

function copyFixture(): string {
  const target = mkdtempSync(path.join(tmpdir(), 'chevron-check-'));
  cpSync(violations, target, { recursive: true });
  writeFileSync(
    path.join(target, 'tsconfig.json'),
    JSON.stringify({
      extends: path.resolve(here, '..', '..', '..', 'tsconfig.base.json'),
      compilerOptions: { noEmit: true, types: [] },
      include: ['src'],
    }),
  );
  symlinkSync(path.resolve(here, '..', 'node_modules'), path.join(target, 'node_modules'));
  return target;
}

describe('chevron check', () => {
  it('finds every planted violation', async () => {
    const report = await check(violations);
    expect(keys(report.findings)).toEqual(EXPECTED);
  }, 30_000);

  it('reports nothing on the reference module', async () => {
    const report = await check(reference);
    expect(report.findings).toEqual([]);
  }, 30_000);

  it('emits the RULES.md JSON shape with a fix for every finding', async () => {
    const report = await check(violations);
    for (const finding of report.findings) {
      expect(finding).toMatchObject({
        ruleId: expect.stringMatching(/^CHV\d{3}$/),
        docs: expect.stringContaining('#chv'),
      });
      expect(finding.fix).not.toBe('');
    }
  }, 30_000);
});

describe('baseline ratchet (CHV091)', () => {
  it('tolerates recorded findings, fails on growth and on stale entries', async () => {
    const project = copyFixture();
    expect(await baseline(project, false)).toMatch(/^Created/);
    expect(await baseline(project, false)).toMatch(/may only shrink/);

    const clean = await check(project);
    expect(clean.findings.map((finding: ChevronFinding) => finding.ruleId)).toEqual(['CHV090']);

    const port = path.join(project, 'src/modules/energy-budget/ports/audit-log.port.ts');
    const original = readFileSync(port, 'utf8');
    writeFileSync(port, `${original}\nexport interface Gauge extends Auditable {}\n`);
    const grown = await check(project);
    expect(
      grown.findings.some((finding: ChevronFinding) => finding.message.includes('grew for CHV021')),
    ).toBe(true);

    writeFileSync(port, original.replace(' extends Auditable', ''));
    const stale = await check(project);
    expect(
      stale.findings.some((finding: ChevronFinding) =>
        finding.message.includes('stale for CHV021'),
      ),
    ).toBe(true);

    await baseline(project, true);
    const pruned = await check(project);
    expect(pruned.findings.map((finding: ChevronFinding) => finding.ruleId)).toEqual(['CHV090']);
  }, 60_000);
});
