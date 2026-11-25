import type { ResultAsync } from 'neverthrow';

import type { Gate, GateAlreadyDecommissioned } from '../domain/gate.js';
import type { GateRepositoryError } from '../ports/gate-repository.port.js';
import type { GateLookupError } from '../services/gate-lookup.service.js';

export type DecommissionGateInput = { readonly address: string };

export type DecommissionGateError =
  GateLookupError | GateAlreadyDecommissioned | GateRepositoryError;

export interface DecommissionGate {
  execute(input: DecommissionGateInput): ResultAsync<Gate, DecommissionGateError>;
}
