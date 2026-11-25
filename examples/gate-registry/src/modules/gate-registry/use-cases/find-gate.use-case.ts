import type { ResultAsync } from 'neverthrow';

import type { Gate } from '../domain/gate.js';
import type { GateLookupError } from '../services/gate-lookup.service.js';

export type FindGateInput = { readonly address: string };

export type FindGateError = GateLookupError;

export interface FindGate {
  execute(input: FindGateInput): ResultAsync<Gate, FindGateError>;
}
