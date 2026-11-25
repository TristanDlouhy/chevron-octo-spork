import { err, ok, type Result } from 'neverthrow';

import type { GateAddress } from './gate-address.js';

export type GateStatus = 'active' | 'decommissioned';

export type Gate = {
  readonly address: GateAddress;
  readonly name: string;
  readonly status: GateStatus;
};

export type InvalidGateName = { readonly type: 'InvalidGateName'; readonly raw: string };

export type GateNotFound = { readonly type: 'GateNotFound'; readonly address: GateAddress };

export type GateAlreadyRegistered = {
  readonly type: 'GateAlreadyRegistered';
  readonly address: GateAddress;
};

export type GateAlreadyDecommissioned = {
  readonly type: 'GateAlreadyDecommissioned';
  readonly address: GateAddress;
};

export const GATE_NAME_MAX_LENGTH = 64;

export function createGate(address: GateAddress, rawName: string): Result<Gate, InvalidGateName> {
  const name = rawName.trim();
  if (name.length === 0 || name.length > GATE_NAME_MAX_LENGTH) {
    return err({ type: 'InvalidGateName', raw: rawName });
  }
  return ok({ address, name, status: 'active' });
}

export function decommissionGate(gate: Gate): Result<Gate, GateAlreadyDecommissioned> {
  if (gate.status === 'decommissioned') {
    return err({ type: 'GateAlreadyDecommissioned', address: gate.address });
  }
  return ok({ ...gate, status: 'decommissioned' });
}
