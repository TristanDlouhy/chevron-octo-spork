import { moduleLayout } from './module-layout.js';
import { noInheritance } from './no-inheritance.js';
import { oneContractOneImpl } from './one-contract-one-impl.js';

/**
 * Spike rules (ADR 0002). Not part of `recommended` yet; rule names are the lower-case Chevron
 * IDs so that `chevron/chv021` maps 1:1 to RULES.md.
 */
export const spikeRules = {
  chv010: moduleLayout,
  chv020: oneContractOneImpl,
  chv021: noInheritance,
};
