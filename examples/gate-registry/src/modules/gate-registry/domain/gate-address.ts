import { err, ok, type Result } from 'neverthrow';

/** Two groups of four upper-case letters or digits, e.g. 'K7QX-204M'. */
export type GateAddress = string & { readonly __brand: 'GateAddress' };

export type InvalidGateAddress = { readonly type: 'InvalidGateAddress'; readonly raw: string };

const GATE_ADDRESS_PATTERN = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;

export function isGateAddress(value: string): value is GateAddress {
  return GATE_ADDRESS_PATTERN.test(value);
}

export function parseGateAddress(raw: string): Result<GateAddress, InvalidGateAddress> {
  const normalized = raw.trim().toUpperCase();
  if (!isGateAddress(normalized)) {
    return err({ type: 'InvalidGateAddress', raw });
  }
  return ok(normalized);
}
