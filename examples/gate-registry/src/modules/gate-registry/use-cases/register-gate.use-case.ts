import type { ResultAsync } from 'neverthrow';

import type { Gate, GateAlreadyRegistered, InvalidGateName } from '../domain/gate.js';
import type { InvalidGateAddress } from '../domain/gate-address.js';
import type { GateRepositoryError } from '../ports/gate-repository.port.js';

export type RegisterGateInput = { readonly address: string; readonly name: string };

export type RegisterGateError =
  InvalidGateAddress | InvalidGateName | GateAlreadyRegistered | GateRepositoryError;

export interface RegisterGate {
  execute(input: RegisterGateInput): ResultAsync<Gate, RegisterGateError>;
}
