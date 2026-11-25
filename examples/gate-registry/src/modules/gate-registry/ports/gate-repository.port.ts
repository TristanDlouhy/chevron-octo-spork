import type { ResultAsync } from 'neverthrow';

import type { Gate } from '../domain/gate.js';
import type { GateAddress } from '../domain/gate-address.js';

export type GateRepositoryError = { readonly type: 'GateRepositoryError'; readonly cause: unknown };

export interface GateRepository {
  findByAddress(address: GateAddress): ResultAsync<Gate | null, GateRepositoryError>;
  save(gate: Gate): ResultAsync<Gate, GateRepositoryError>;
}
