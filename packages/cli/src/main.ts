#!/usr/bin/env node
import { parseArgs } from 'node:util';

import { ruleCatalog } from 'eslint-plugin-chevron';

import { baseline, check } from './check/check.js';
import { formatText } from './check/finding.js';

const USAGE = `Usage: chevron <command> [options]

Commands:
  check       Run project-wide Chevron checks (CHV001, CHV010, CHV014, CHV020, CHV032, CHV090, CHV091)
  baseline    Record current violations in chevron-baseline.json (CHV091); --prune only shrinks it
  rules       List all Chevron rule ids

Options:
  --format <text|json>   Output format (default: text)
  --project <dir>        Project directory (default: current directory)
  --prune                With 'baseline': lower counts to the current state, never raise
  -h, --help             Show this help
`;

const EXIT_OK = 0;
const EXIT_VIOLATIONS = 1;
const EXIT_NOT_IMPLEMENTED = 2;

function listRules(format: string): number {
  if (format === 'json') {
    process.stdout.write(`${JSON.stringify(ruleCatalog, null, 2)}\n`);
    return EXIT_OK;
  }
  for (const entry of ruleCatalog) {
    process.stdout.write(
      `${entry.id} ${entry.slug.padEnd(30)} ${entry.status.padEnd(8)} ${entry.summary}\n`,
    );
  }
  return EXIT_OK;
}

async function run(argv: readonly string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      format: { type: 'string', default: 'text' },
      help: { type: 'boolean', short: 'h', default: false },
      project: { type: 'string', default: process.cwd() },
      prune: { type: 'boolean', default: false },
    },
  });

  const command = positionals[0];
  if (values.help || command === undefined) {
    process.stdout.write(USAGE);
    return EXIT_OK;
  }

  switch (command) {
    case 'rules':
      return listRules(values.format);
    case 'check':
    case 'baseline': {
      if (command === 'baseline') {
        process.stdout.write(`${await baseline(values.project, values.prune)}\n`);
        return EXIT_OK;
      }
      const report = await check(values.project);
      if (values.format === 'json') {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      } else {
        for (const finding of report.findings) {
          process.stdout.write(`${formatText(finding)}\n`);
        }
        process.stdout.write(
          `${String(report.findings.length)} finding(s), ${String(report.suppressed)} suppressed by baseline, ${String(report.durationMs)} ms.\n`,
        );
      }
      return report.findings.length === 0 ? EXIT_OK : EXIT_VIOLATIONS;
    }
    default:
      process.stderr.write(`Unknown command '${command}'.\n\n${USAGE}`);
      return EXIT_NOT_IMPLEMENTED;
  }
}

process.exitCode = await run(process.argv.slice(2));
