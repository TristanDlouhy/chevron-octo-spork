# Reference module: gate-registry

The one module every Chevron rule is checked against. It is part of the benchmark task "gate network"
(see [benchmark/](../../benchmark)): a registry of gates with an address, a name and a status.

| Operation           | Use case           | Errors                                                                                   |
| ------------------- | ------------------ | ---------------------------------------------------------------------------------------- |
| Register a gate     | `RegisterGate`     | `InvalidGateAddress`, `InvalidGateName`, `GateAlreadyRegistered`, `GateRepositoryError`  |
| Find a gate         | `FindGate`         | `InvalidGateAddress`, `GateNotFound`, `GateRepositoryError`                              |
| Decommission a gate | `DecommissionGate` | `InvalidGateAddress`, `GateNotFound`, `GateAlreadyDecommissioned`, `GateRepositoryError` |

A gate address is two groups of four upper-case letters or digits (`K7QX-204M`); input is trimmed and
upper-cased. A name is 1–64 characters after trimming.

```
src/modules/gate-registry/
├── index.ts                                   public API
├── gate-registry.module.ts                    composition root
├── domain/        gate.ts, gate-address.ts    types, tagged errors, pure functions
├── ports/         gate-repository.port.ts
├── services/      gate-lookup.service(.impl).ts   used by find-gate and decommission-gate
├── use-cases/     register-gate, find-gate, decommission-gate (.use-case.ts + .use-case.impl.ts)
└── adapters/      in-memory-gate-repository.adapter.ts
```

No driving adapter (HTTP, CLI) yet: where it lives is an open point in RULES.md.
