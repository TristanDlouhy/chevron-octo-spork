import { describe, expect, it } from 'vitest';

import { findRuleByDelegate, ruleCatalog } from './rule-catalog.js';

describe('ruleCatalog', () => {
  it('has unique ids and slugs', () => {
    const ids = ruleCatalog.map((entry) => entry.id);
    const slugs = ruleCatalog.map((entry) => entry.slug);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('uses three-digit CHV ids', () => {
    for (const entry of ruleCatalog) {
      expect(entry.id).toMatch(/^CHV\d{3}$/);
    }
  });

  it('has a fix instruction for every rule whose findings come without one', () => {
    for (const entry of ruleCatalog) {
      if (entry.delegatesTo.length > 0 || entry.id === 'CHV090') {
        expect(entry, entry.id).toHaveProperty('fix');
      }
    }
  });

  it('maps delegated typescript-eslint rules to their Chevron id', () => {
    expect(findRuleByDelegate('@typescript-eslint/no-explicit-any')?.id).toBe('CHV002');
    expect(findRuleByDelegate('@typescript-eslint/ban-ts-comment')?.id).toBe('CHV004');
    expect(findRuleByDelegate('no-console')).toBeUndefined();
  });
});
