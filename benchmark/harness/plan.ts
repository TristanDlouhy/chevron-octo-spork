// Randomised, reproducible run order. Usage: node harness/plan.ts <seed> <reps> <variant,...> <agent,...>
// Example (pilot): node harness/plan.ts 20261125 5 A A1,A2,A3,A4 > pilot-runs.txt
const [seedArg, repsArg, variantsArg, agentsArg] = process.argv.slice(2);
if (!seedArg || !repsArg || !variantsArg || !agentsArg) {
  process.stderr.write('usage: node harness/plan.ts <seed> <reps> <variants> <agents>\n');
  process.exit(2);
}
let state = Number(seedArg) >>> 0;
function random(): number {
  // mulberry32
  state = (state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const runs: string[] = [];
for (const v of variantsArg.split(',')) {
  for (const a of agentsArg.split(',')) {
    for (let r = 1; r <= Number(repsArg); r += 1) {
      runs.push(`${v} ${a} ${r}`);
    }
  }
}
for (let i = runs.length - 1; i > 0; i -= 1) {
  const j = Math.floor(random() * (i + 1));
  [runs[i], runs[j]] = [runs[j] ?? '', runs[i] ?? ''];
}
process.stdout.write(`# seed ${seedArg}\n${runs.join('\n')}\n`);
