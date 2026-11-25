import { noInheritance } from './no-inheritance.js';
import { oneContractOneImpl } from './one-contract-one-impl.js';

/**
 * Custom Chevron rules. Rule names are the lower-case Chevron IDs, so `chevron/chv021` maps 1:1
 * to RULES.md. Per ADR 0002 they only look at the linted file, never at the file system.
 */
export const chevronRules = {
  chv020: oneContractOneImpl,
  chv021: noInheritance,
};
