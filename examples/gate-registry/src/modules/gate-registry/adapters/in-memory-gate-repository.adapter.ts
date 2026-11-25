import { okAsync, type ResultAsync } from 'neverthrow';

import type { Gate } from '../domain/gate.js';
import type { GateAddress } from '../domain/gate-address.js';
import type { GateRepository, GateRepositoryError } from '../ports/gate-repository.port.js';

/** Driven adapter for tests and the benchmark. A database adapter would translate exceptions here. */
export class InMemoryGateRepository implements GateRepository {
  private readonly gates = new Map<GateAddress, Gate>();

  public constructor(initialGates: readonly Gate[] = []) {
    for (const gate of initialGates) {
      this.gates.set(gate.address, gate);
    }
  }

  public findByAddress(address: GateAddress): ResultAsync<Gate | null, GateRepositoryError> {
    return okAsync(this.gates.get(address) ?? null);
  }

  public save(gate: Gate): ResultAsync<Gate, GateRepositoryError> {
    this.gates.set(gate.address, gate);
    return okAsync(gate);
  }
}
