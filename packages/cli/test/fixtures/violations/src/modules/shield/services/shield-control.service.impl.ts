import type { ShieldControlService } from './shield-control.service.js';

export abstract class ShieldControlServiceImpl implements ShieldControlService {
  public abstract isOpen(): boolean;
}
