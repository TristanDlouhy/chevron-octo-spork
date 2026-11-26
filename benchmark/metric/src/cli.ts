// Usage: node metric/src/cli.ts <solutionDir> [<solutionDir> ...] > distances.json
import { basename, resolve } from 'node:path';
import { distance, meanPairwise } from './distance.ts';
import { extract } from './extract.ts';

const dirs = process.argv.slice(2).map((d) => resolve(d));
if (dirs.length === 0) {
  process.stderr.write('usage: node metric/src/cli.ts <solutionDir>...\n');
  process.exit(2);
}
const models = dirs.map((d) => ({ run: basename(d), model: extract(d) }));
const pairs = [];
for (let i = 0; i < models.length; i += 1) {
  for (let j = i + 1; j < models.length; j += 1) {
    pairs.push({
      a: models[i]!.run,
      b: models[j]!.run,
      ...distance(models[i]!.model, models[j]!.model),
    });
  }
}
const report = {
  runs: models.map(({ run, model }) => ({ run, depths: model.depths, stats: model.stats })),
  pairs,
  meanPairwiseDistance: meanPairwise(models.map((m) => m.model)),
};
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
