import type { ResultAsync } from 'neverthrow';

import type { Gate } from '../domain/gate.js';
import type { GateLookupService } from '../services/gate-lookup.service.js';
import type { FindGate, FindGateError, FindGateInput } from './find-gate.use-case.js';

export class FindGateImpl implements FindGate {
  public constructor(private readonly gateLookup: GateLookupService) {}

  public execute(input: FindGateInput): ResultAsync<Gate, FindGateError> {
    return this.gateLookup.getByAddress(input.address);
  }
}
