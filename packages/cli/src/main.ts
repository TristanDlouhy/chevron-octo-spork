#!/usr/bin/env node
import { parseArgs } from 'node:util';

import { ruleCatalog } from 'eslint-plugin-chevron';

const USAGE = `Usage: chevron <command> [options]

Commands:
  check       Run project-wide Chevron checks (CHV001, CHV010, CHV014, CHV020, CHV032, CHV090, CHV091)
  baseline    Record current violations in chevron-baseline.json (CHV091)
  rules       List all Chevron rule ids

Options:
  --format <text|json>   Output format (default: text)
  -h, --help             Show this help
`;

const EXIT_OK = 0;
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

function run(argv: readonly string[]): number {
  const { values, positionals } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      format: { type: 'string', default: 'text' },
      help: { type: 'boolean', short: 'h', default: false },
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
    case 'baseline':
      process.stderr.write(
        `chevron ${command}: not implemented yet (see RULES.md, column "Prüfung").\n`,
      );
      return EXIT_NOT_IMPLEMENTED;
    default:
      process.stderr.write(`Unknown command '${command}'.\n\n${USAGE}`);
      return EXIT_NOT_IMPLEMENTED;
  }
}

process.exitCode = run(process.argv.slice(2));
