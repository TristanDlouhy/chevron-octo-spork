import { ESLintUtils } from '@typescript-eslint/utils';

import { RULES_DOCS_URL } from '../rule-catalog.js';

/**
 * All custom Chevron rules use one message shape so that agents (and the JSON formatter) can split
 * it: `<ID> <slug>: <finding>. Fix: <instruction>.`
 */
export const createRule = ESLintUtils.RuleCreator(
  (ruleName: string) => `${RULES_DOCS_URL}#${ruleName}`,
);

export function chevronMessage(id: string, slug: string): string {
  return `${id} ${slug}: {{finding}}. Fix: {{fix}}.`;
}
