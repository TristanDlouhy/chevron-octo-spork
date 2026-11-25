import path from 'node:path';

import type { Node } from 'ts-morph';

export type Location = { readonly file: string; readonly line: number; readonly column: number };

export function locate(projectDir: string, node: Node): Location {
  const sourceFile = node.getSourceFile();
  const { line, column } = sourceFile.getLineAndColumnAtPos(node.getStart());
  return { file: path.relative(projectDir, sourceFile.getFilePath()), line, column };
}
