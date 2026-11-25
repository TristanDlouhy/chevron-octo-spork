import { Node, SyntaxKind, type SourceFile, type Type } from 'ts-morph';

import { createFinding, type ChevronFinding } from '../finding.js';
import { locate } from './location.js';

const FIX = "Use 'unknown' and narrow with a type guard";

function isAny(type: Type): boolean {
  return type.isAny();
}

/**
 * CHV002 re-implemented on the TypeScript checker. Covers the same six cases as the delegated
 * typescript-eslint rules, but only in their simplest form (no generics like `Promise<any>`, no
 * `any[]` spread, no `this` typing, no tuple/rest handling, no destructuring). Exactly this
 * maintenance surface is what ADR 0002 weighs against delegating to typescript-eslint.
 */
export function checkNoAny(projectDir: string, sourceFile: SourceFile): ChevronFinding[] {
  const findings: ChevronFinding[] = [];
  const report = (node: Node, message: string): void => {
    findings.push(
      createFinding({
        ruleId: 'CHV002',
        ...locate(projectDir, node),
        message,
        fix: FIX,
        source: 'ts-morph',
      }),
    );
  };

  sourceFile.forEachDescendant((node: Node) => {
    if (node.getKind() === SyntaxKind.AnyKeyword) {
      report(node, "Unexpected 'any' type annotation");
      return;
    }
    if (Node.isVariableDeclaration(node)) {
      const initializer = node.getInitializer();
      if (
        initializer !== undefined &&
        isAny(initializer.getType()) &&
        node.getTypeNode()?.getKind() !== SyntaxKind.AnyKeyword
      ) {
        report(node, `Unsafe assignment of an 'any' value to '${node.getName()}'`);
      }
      return;
    }
    if (Node.isPropertyAccessExpression(node) && isAny(node.getExpression().getType())) {
      report(node.getNameNode(), `Unsafe member access '.${node.getName()}' on an 'any' value`);
      return;
    }
    if (Node.isCallExpression(node)) {
      if (isAny(node.getExpression().getType())) {
        report(node, "Unsafe call of an 'any' value");
      }
      for (const argument of node.getArguments()) {
        if (isAny(argument.getType())) {
          report(argument, "Unsafe argument of type 'any'");
        }
      }
      return;
    }
    if (Node.isReturnStatement(node)) {
      const expression = node.getExpression();
      if (expression !== undefined && isAny(expression.getType())) {
        report(expression, "Unsafe return of an 'any' value");
      }
    }
  });
  return findings;
}
