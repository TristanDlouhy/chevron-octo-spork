import type { ResultAsync } from 'neverthrow';

import { decommissionGate, type Gate } from '../domain/gate.js';
import type { GateRepository } from '../ports/gate-repository.port.js';
import type { GateLookupService } from '../services/gate-lookup.service.js';
import type {
  DecommissionGate,
  DecommissionGateError,
  DecommissionGateInput,
} from './decommission-gate.use-case.js';

export class DecommissionGateImpl implements DecommissionGate {
  public constructor(
    private readonly gateLookup: GateLookupService,
    private readonly gateRepository: GateRepository,
  ) {}

  public execute(input: DecommissionGateInput): ResultAsync<Gate, DecommissionGateError> {
    return this.gateLookup
      .getByAddress(input.address)
      .andThen((gate: Gate) => decommissionGate(gate))
      .andThen((gate: Gate) => this.gateRepository.save(gate));
  }
}
