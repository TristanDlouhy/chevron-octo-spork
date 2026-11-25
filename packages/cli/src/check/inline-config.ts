import path from 'node:path';

import ts from 'typescript';

import { createFinding, type ChevronFinding } from './finding.js';

const DIRECTIVE =
  /^\s*(eslint-disable-next-line|eslint-disable-line|eslint-disable|eslint-enable|eslint(?=\s)|global(?=\s)|exported(?=\s))/;

/**
 * CHV090: finds ESLint directive comments with the TypeScript scanner, independent of any ESLint
 * configuration. A comment counts if its text (after `//` or `/*`) starts with a directive keyword.
 */
export function checkInlineConfig(
  projectDir: string,
  fileName: string,
  text: string,
): ChevronFinding[] {
  const lineStarts = computeLineStarts(text);
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    ts.LanguageVariant.Standard,
    text,
  );
  const findings: ChevronFinding[] = [];
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    if (
      token !== ts.SyntaxKind.SingleLineCommentTrivia &&
      token !== ts.SyntaxKind.MultiLineCommentTrivia
    ) {
      continue;
    }
    const body = scanner.getTokenText().replace(/^\/[/*]/, '');
    const directive = DIRECTIVE.exec(body)?.[1];
    if (directive === undefined) {
      continue;
    }
    const position = toLineAndCharacter(lineStarts, scanner.getTokenStart());
    const relative = path.relative(projectDir, fileName);
    findings.push(
      createFinding({
        ruleId: 'CHV090',
        file: relative,
        line: position.line + 1,
        column: position.character + 1,
        message: `Inline directive '${directive}' in '${relative}:${String(position.line + 1)}'`,
        fix: 'Remove the directive and fix the violation; exceptions belong in chevron.config with a reason',
        source: 'chevron-cli',
      }),
    );
  }
  return findings;
}

function computeLineStarts(text: string): number[] {
  const starts = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '\n') {
      starts.push(index + 1);
    }
  }
  return starts;
}

function toLineAndCharacter(
  lineStarts: readonly number[],
  position: number,
): { line: number; character: number } {
  let line = 0;
  while (line + 1 < lineStarts.length && (lineStarts[line + 1] ?? Infinity) <= position) {
    line += 1;
  }
  return { line, character: position - (lineStarts[line] ?? 0) };
}
