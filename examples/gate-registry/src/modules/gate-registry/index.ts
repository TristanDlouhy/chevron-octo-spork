export type {
  Gate,
  GateAlreadyDecommissioned,
  GateAlreadyRegistered,
  GateNotFound,
  GateStatus,
  InvalidGateName,
} from './domain/gate.js';
export type { GateAddress, InvalidGateAddress } from './domain/gate-address.js';
export type { GateRepository, GateRepositoryError } from './ports/gate-repository.port.js';
export type {
  DecommissionGate,
  DecommissionGateError,
  DecommissionGateInput,
} from './use-cases/decommission-gate.use-case.js';
export type { FindGate, FindGateError, FindGateInput } from './use-cases/find-gate.use-case.js';
export type {
  RegisterGate,
  RegisterGateError,
  RegisterGateInput,
} from './use-cases/register-gate.use-case.js';
export { InMemoryGateRepository } from './adapters/in-memory-gate-repository.adapter.js';
export {
  createGateRegistryModule,
  type GateRegistryDependencies,
  type GateRegistryModule,
} from './gate-registry.module.js';
