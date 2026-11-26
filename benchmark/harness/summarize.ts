// Collect all evaluated runs into one summary and compute the structural distances per variant.
// Usage: node harness/summarize.ts [outRoot] > summary.json
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { distance } from '../metric/src/distance.ts';
import { extract } from '../metric/src/extract.ts';
import type { StructureModel } from '../metric/src/model.ts';

const outRoot = process.argv[2] ?? process.env['CHEVRON_RUNS'] ?? join(homedir(), 'chevron-runs');

function readJson(path: string): any {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
}

interface Run {
  runId: string;
  variant: string;
  agent: string;
  meta: any;
  tscOk: boolean;
  testsPassed: number;
  testsTotal: number;
  tokens: number;
  model: StructureModel | null;
}

const runs: Run[] = [];
for (const name of readdirSync(outRoot).sort()) {
  const dir = join(outRoot, name);
  const meta = readJson(join(dir, 'meta.json'));
  if (!meta || !existsSync(join(dir, 'eval'))) {
    continue;
  }
  const acceptance = readJson(join(dir, 'eval/acceptance.json'));
  const hasSource = existsSync(join(dir, 'work/src'));
  runs.push({
    runId: meta.runId,
    variant: meta.variant,
    agent: meta.agent,
    meta,
    tscOk: readJson(join(dir, 'eval/tsc.json'))?.ok === true,
    testsPassed: acceptance?.numPassedTests ?? 0,
    testsTotal: acceptance?.numTotalTests ?? 67,
    tokens: readJson(join(dir, 'eval/tokens.json'))?.totalTokens ?? 0,
    model: hasSource ? extract(join(dir, 'work')) : null,
  });
}

const variants = [...new Set(runs.map((r) => r.variant))].sort();
const byVariant = variants.map((variant) => {
  const vr = runs.filter((r) => r.variant === variant && r.model !== null);
  const within: number[] = [];
  const between: number[] = [];
  for (let i = 0; i < vr.length; i += 1) {
    for (let j = i + 1; j < vr.length; j += 1) {
      const d = distance(vr[i]!.model!, vr[j]!.model!).total;
      (vr[i]!.agent === vr[j]!.agent ? within : between).push(d);
    }
  }
  const mean = (xs: number[]): number | null =>
    xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length;
  const all = runs.filter((r) => r.variant === variant);
  return {
    variant,
    runs: all.length,
    runsWithCode: vr.length,
    meanPairwiseDistance: mean([...within, ...between]),
    meanWithinAgent: mean(within),
    meanBetweenAgents: mean(between),
    testPassRate: mean(all.map((r) => r.testsPassed / r.testsTotal)),
    tscPassRate: mean(all.map((r) => (r.tscOk ? 1 : 0))),
    medianTokens:
      [...all.map((r) => r.tokens)].sort((a, b) => a - b)[Math.floor(all.length / 2)] ?? null,
  };
});

process.stdout.write(
  JSON.stringify(
    {
      outRoot,
      variants: byVariant,
      runs: runs.map(({ model, ...r }) => ({
        ...r,
        meta: undefined,
        depths: model?.depths ?? null,
        stats: model?.stats ?? null,
      })),
    },
    null,
    2,
  ) + '\n',
);
