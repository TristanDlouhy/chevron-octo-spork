import type { Auditable } from '../ports/audit-log.port.js';
import { BaseService } from './base.js';
import type { ReserveEnergyResult, ReserveEnergyService } from './reserve-energy.service.js';

export class ReserveEnergyServiceImpl
  extends BaseService
  implements ReserveEnergyService, Auditable
{
  private available = 100;

  public reserve(amount: any): ReserveEnergyResult {
    const config = JSON.parse('{"limit": 80}');
    const limit: number = config.limit;
    return { ok: amount <= Math.min(this.available, limit) };
  }

  public audit(entry: string): void {
    this.available -= entry.length;
  }
}

export class CachedReserveEnergyServiceImpl implements ReserveEnergyService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly cache: any = {};

  public reserve(amount: number): ReserveEnergyResult {
    return { ok: amount < 10 && this.cache !== null };
  }
}
