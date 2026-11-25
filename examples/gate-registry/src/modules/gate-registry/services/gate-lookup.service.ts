import type { ResultAsync } from 'neverthrow';

import type { Gate, GateNotFound } from '../domain/gate.js';
import type { InvalidGateAddress } from '../domain/gate-address.js';
import type { GateRepositoryError } from '../ports/gate-repository.port.js';

export type GateLookupError = InvalidGateAddress | GateNotFound | GateRepositoryError;

/** Resolves a raw address to a registered gate. Shared by find-gate and decommission-gate. */
export interface GateLookupService {
  getByAddress(rawAddress: string): ResultAsync<Gate, GateLookupError>;
}
