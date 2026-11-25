import { err, ok, type Result, type ResultAsync } from 'neverthrow';

import type { Gate, GateNotFound } from '../domain/gate.js';
import { parseGateAddress, type GateAddress } from '../domain/gate-address.js';
import type { GateRepository } from '../ports/gate-repository.port.js';
import type { GateLookupError, GateLookupService } from './gate-lookup.service.js';

export class GateLookupServiceImpl implements GateLookupService {
  public constructor(private readonly gateRepository: GateRepository) {}

  public getByAddress(rawAddress: string): ResultAsync<Gate, GateLookupError> {
    return parseGateAddress(rawAddress).asyncAndThen((address: GateAddress) =>
      this.gateRepository
        .findByAddress(address)
        .andThen((gate: Gate | null): Result<Gate, GateNotFound> =>
          gate === null ? err({ type: 'GateNotFound', address }) : ok(gate),
        ),
    );
  }
}
