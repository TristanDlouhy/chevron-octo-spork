import { existsSync } from 'node:fs';
import path from 'node:path';

import type { TSESTree } from '@typescript-eslint/utils';

import { chevronMessage, createRule } from './create-rule.js';
import { classifyContractFile, partnerFileName, resolveModulePath } from './module-path.js';

/**
 * CHV020: every `<x>.service.ts` / `<x>.use-case.ts` has exactly one `.impl.ts` partner and vice
 * versa; the impl file holds exactly one class implementing exactly the partner's interface.
 *
 * Spike note: the pair check reads the file system. ESLint's cache (`--cache`) does not know about
 * this dependency, so deleting an impl file does not invalidate the cached result of its contract.
 */
export const oneContractOneImpl = createRule({
  name: 'chv020',
  meta: {
    type: 'problem',
    docs: {
      description: 'Exactly one interface and one implementation per service/use case (CHV020).',
    },
    schema: [],
    messages: { violation: chevronMessage('CHV020', 'one-contract-one-impl') },
  },
  defaultOptions: [],
  create(context) {
    const modulePath = resolveModulePath(context.filename);
    const contractFile = classifyContractFile(context.filename);
    if (modulePath === undefined || contractFile === undefined) {
      return {};
    }
    const fileName = path.basename(context.filename);
    const partner = partnerFileName(contractFile);
    const partnerImportPath = `./${partner.replace(/\.ts$/, '.js')}`;
    const classes: TSESTree.ClassDeclaration[] = [];
    const importedFrom = new Map<string, string>();

    return {
      ImportSpecifier(node: TSESTree.ImportSpecifier): void {
        if (node.parent.type === 'ImportDeclaration') {
          importedFrom.set(node.local.name, node.parent.source.value);
        }
      },
      ClassDeclaration(node: TSESTree.ClassDeclaration): void {
        classes.push(node);
      },
      'Program:exit'(program: TSESTree.Program): void {
        if (!existsSync(path.join(path.dirname(context.filename), partner))) {
          const finding =
            contractFile.role === 'contract'
              ? `'${fileName}' has no implementation file`
              : `'${fileName}' has no contract file`;
          context.report({
            node: program,
            loc: { line: 1, column: 0 },
            messageId: 'violation',
            data: { finding, fix: `Create '${partner}' next to it` },
          });
        }
        if (contractFile.role === 'contract') {
          return;
        }
        if (classes.length !== 1) {
          context.report({
            node: classes[1] ?? program,
            messageId: 'violation',
            data: {
              finding: `'${fileName}' declares ${String(classes.length)} classes`,
              fix: 'Keep exactly one class that implements the interface from the contract file',
            },
          });
        }
        for (const classNode of classes) {
          const implemented = classNode.implements.map(
            (clause: TSESTree.TSClassImplements): string =>
              context.sourceCode.getText(clause.expression),
          );
          const fromPartner = implemented.filter(
            (name: string) => importedFrom.get(name) === partnerImportPath,
          );
          if (implemented.length !== 1 || fromPartner.length !== 1) {
            context.report({
              node: classNode.id ?? classNode,
              messageId: 'violation',
              data: {
                finding: `Class '${classNode.id?.name ?? '<anonymous>'}' implements [${implemented.join(', ')}]`,
                fix: `Implement exactly the one interface exported by '${partner}'`,
              },
            });
          }
        }
      },
    };
  },
});
