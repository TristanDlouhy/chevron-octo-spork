import { describe, expect, it } from 'vitest';

import { InMemoryGateRepository } from './adapters/in-memory-gate-repository.adapter.js';
import { createGateRegistryModule, type GateRegistryModule } from './gate-registry.module.js';

function createModule(): GateRegistryModule {
  return createGateRegistryModule({ gateRepository: new InMemoryGateRepository() });
}

describe('gate registry', () => {
  it('registers a gate and finds it by address', async () => {
    const registry = createModule();

    const registered = await registry.registerGate.execute({
      address: 'k7qx-204m',
      name: ' Relay North ',
    });
    const found = await registry.findGate.execute({ address: 'K7QX-204M' });

    expect(registered._unsafeUnwrap()).toEqual({
      address: 'K7QX-204M',
      name: 'Relay North',
      status: 'active',
    });
    expect(found._unsafeUnwrap()).toEqual(registered._unsafeUnwrap());
  });

  it('rejects a duplicate address', async () => {
    const registry = createModule();
    await registry.registerGate.execute({ address: 'K7QX-204M', name: 'Relay North' });

    const duplicate = await registry.registerGate.execute({
      address: 'K7QX-204M',
      name: 'Relay South',
    });

    expect(duplicate._unsafeUnwrapErr()).toEqual({
      type: 'GateAlreadyRegistered',
      address: 'K7QX-204M',
    });
  });

  it('rejects an invalid address and an invalid name', async () => {
    const registry = createModule();

    const badAddress = await registry.registerGate.execute({
      address: 'nope',
      name: 'Relay North',
    });
    const badName = await registry.registerGate.execute({ address: 'K7QX-204M', name: '   ' });

    expect(badAddress._unsafeUnwrapErr()).toEqual({ type: 'InvalidGateAddress', raw: 'nope' });
    expect(badName._unsafeUnwrapErr()).toEqual({ type: 'InvalidGateName', raw: '   ' });
  });

  it('reports an unknown gate', async () => {
    const registry = createModule();

    const result = await registry.findGate.execute({ address: 'AAAA-0000' });

    expect(result._unsafeUnwrapErr()).toEqual({ type: 'GateNotFound', address: 'AAAA-0000' });
  });

  it('decommissions a gate exactly once', async () => {
    const registry = createModule();
    await registry.registerGate.execute({ address: 'K7QX-204M', name: 'Relay North' });

    const first = await registry.decommissionGate.execute({ address: 'K7QX-204M' });
    const second = await registry.decommissionGate.execute({ address: 'K7QX-204M' });

    expect(first._unsafeUnwrap().status).toBe('decommissioned');
    expect(second._unsafeUnwrapErr()).toEqual({
      type: 'GateAlreadyDecommissioned',
      address: 'K7QX-204M',
    });
  });
});
