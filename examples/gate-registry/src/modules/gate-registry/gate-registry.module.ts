import type { GateRepository } from './ports/gate-repository.port.js';
import { GateLookupServiceImpl } from './services/gate-lookup.service.impl.js';
import type { DecommissionGate } from './use-cases/decommission-gate.use-case.js';
import { DecommissionGateImpl } from './use-cases/decommission-gate.use-case.impl.js';
import type { FindGate } from './use-cases/find-gate.use-case.js';
import { FindGateImpl } from './use-cases/find-gate.use-case.impl.js';
import type { RegisterGate } from './use-cases/register-gate.use-case.js';
import { RegisterGateImpl } from './use-cases/register-gate.use-case.impl.js';

export type GateRegistryDependencies = {
  readonly gateRepository: GateRepository;
};

export type GateRegistryModule = {
  readonly registerGate: RegisterGate;
  readonly findGate: FindGate;
  readonly decommissionGate: DecommissionGate;
};

/** Composition root: the only place where implementations are instantiated (CHV025). */
export function createGateRegistryModule(
  dependencies: GateRegistryDependencies,
): GateRegistryModule {
  const gateLookup = new GateLookupServiceImpl(dependencies.gateRepository);
  return {
    registerGate: new RegisterGateImpl(dependencies.gateRepository),
    findGate: new FindGateImpl(gateLookup),
    decommissionGate: new DecommissionGateImpl(gateLookup, dependencies.gateRepository),
  };
}
