import type { ESLint } from 'eslint';

import { createRecommendedConfig } from './configs/recommended.js';

export {
  findRuleByDelegate,
  ruleCatalog,
  ruleDocsUrl,
  RULES_DOCS_URL,
  type ChevronRuleId,
  type RuleCatalogEntry,
  type RuleCheck,
  type RuleStatus,
} from './rule-catalog.js';
export { createRecommendedConfig, type RecommendedConfigOptions } from './configs/recommended.js';

const plugin = {
  meta: {
    name: 'eslint-plugin-chevron',
    version: '0.0.0',
  },
  // Custom Chevron rules (CHV011 ff.) are added here once implemented.
  rules: {},
} satisfies ESLint.Plugin;

export const chevron = {
  plugin,
  configs: {
    recommended: createRecommendedConfig,
  },
};
