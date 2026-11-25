import type { InsufficientEnergy } from '../domain/energy.js';

export type ReserveEnergyResult = { readonly ok: boolean; readonly error?: InsufficientEnergy };

export interface ReserveEnergyService {
  reserve(amount: number): ReserveEnergyResult;
}
