import { err, ok, type Result, type ResultAsync } from 'neverthrow';

import { createGate, type Gate, type GateAlreadyRegistered } from '../domain/gate.js';
import { parseGateAddress } from '../domain/gate-address.js';
import type { GateRepository } from '../ports/gate-repository.port.js';
import type {
  RegisterGate,
  RegisterGateError,
  RegisterGateInput,
} from './register-gate.use-case.js';

export class RegisterGateImpl implements RegisterGate {
  public constructor(private readonly gateRepository: GateRepository) {}

  public execute(input: RegisterGateInput): ResultAsync<Gate, RegisterGateError> {
    return parseGateAddress(input.address)
      .andThen((address) => createGate(address, input.name))
      .asyncAndThen((gate: Gate) =>
        this.gateRepository
          .findByAddress(gate.address)
          .andThen((existing: Gate | null): Result<Gate, GateAlreadyRegistered> =>
            existing === null
              ? ok(gate)
              : err({ type: 'GateAlreadyRegistered', address: gate.address }),
          ),
      )
      .andThen((gate: Gate) => this.gateRepository.save(gate));
  }
}
