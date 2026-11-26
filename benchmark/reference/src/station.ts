import type { Hardware, TelemetryFrame } from 'hardware-sim';

export interface GateDefinition {
  address: string;
  name: string;
  distanceClass: 1 | 2 | 3 | 4 | 5;
  state: 'operational' | 'decommissioned';
}

export type ErrorCode =
  | 'INVALID_REQUEST'
  | 'INVALID_ADDRESS'
  | 'UNKNOWN_GATE'
  | 'GATE_ALREADY_ACTIVE'
  | 'INSUFFICIENT_ENERGY'
  | 'SCHEDULE_CONFLICT'
  | 'NOT_CONNECTED'
  | 'SHIELD_CLOSED'
  | 'CONNECTION_LOST'
  | 'HARDWARE_FAILURE';

export class StationError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

type GateState = 'idle' | 'dialing' | 'connected' | 'incoming';
type WindowStatus = 'scheduled' | 'active' | 'completed' | 'failed';

interface ScheduleWindow {
  id: string;
  address: string;
  startTick: number;
  duration: number;
  status: WindowStatus;
  reason?: ErrorCode;
  connectedTicks: number;
}

export type StationEvent = { tick: number; type: string } & Record<string, unknown>;

interface StoredFrame extends TelemetryFrame {
  tick: number;
}

const CAPACITY = 1000;
const DIAL_TICKS = 3;
const RECHARGE = 20;
const SHIELD_COST = 2;
const LOW_SIGNAL = 20;

export function validateAddress(
  address: string,
): { valid: true } | { valid: false; reason: 'FORMAT' | 'CHECK_LETTER' } {
  const match = /^[A-Z]{2}-(\d{4})-([A-Z])$/.exec(address);
  if (!match) {
    return { valid: false, reason: 'FORMAT' };
  }
  const digits = match[1] ?? '';
  const sum = [...digits].reduce((acc, d) => acc + Number(d), 0);
  const expected = String.fromCharCode(65 + (sum % 26));
  return match[2] === expected ? { valid: true } : { valid: false, reason: 'CHECK_LETTER' };
}

export function dialCost(distanceClass: number): number {
  return 50 + 40 * distanceClass;
}

export function holdingCost(distanceClass: number): number {
  return 5 * distanceClass;
}

export class Station {
  private tick = 0;
  private energy: number;
  private gateState: GateState = 'idle';
  private shield: 'open' | 'closed' = 'open';
  private remote: string | null = null;
  private remoteClass = 0;
  private dialStart = 0;
  private incomingStart = 0;
  private incomingDuration = 0;
  private lowSignalStreak = 0;
  private pendingLost = false;
  private droppedTransmissions = 0;
  private sentBytes = 0;
  private readonly frames: StoredFrame[] = [];
  private readonly windows: ScheduleWindow[] = [];
  private activeWindow: ScheduleWindow | null = null;

  constructor(
    private readonly gates: readonly GateDefinition[],
    initialEnergy: number,
    private readonly hardware: Hardware,
  ) {
    this.energy = initialEnergy;
  }

  listGates(state?: string): GateDefinition[] {
    if (state === undefined) {
      return [...this.gates];
    }
    if (state !== 'operational' && state !== 'decommissioned') {
      throw new StationError('INVALID_REQUEST', 'state must be operational or decommissioned');
    }
    return this.gates.filter((g) => g.state === state);
  }

  private dialableGate(address: string): GateDefinition {
    if (!validateAddress(address).valid) {
      throw new StationError('INVALID_ADDRESS', `invalid address ${address}`);
    }
    const gate = this.gates.find((g) => g.address === address);
    if (!gate || gate.state !== 'operational') {
      throw new StationError('UNKNOWN_GATE', `no operational gate at ${address}`);
    }
    return gate;
  }

  dial(address: string): { state: 'dialing'; address: string; energy: number } {
    this.startDial(address, this.tick);
    return { state: 'dialing', address, energy: this.energy };
  }

  private startDial(address: string, startTick: number): void {
    const gate = this.dialableGate(address);
    if (this.gateState !== 'idle') {
      throw new StationError('GATE_ALREADY_ACTIVE', `gate is ${this.gateState}`);
    }
    const cost = dialCost(gate.distanceClass);
    if (this.energy < cost) {
      throw new StationError('INSUFFICIENT_ENERGY', `dial needs ${cost} EU, have ${this.energy}`);
    }
    try {
      this.hardware.engageDialer(address);
    } catch {
      throw new StationError('HARDWARE_FAILURE', 'dialer failed');
    }
    this.energy -= cost;
    this.gateState = 'dialing';
    this.remote = address;
    this.remoteClass = gate.distanceClass;
    this.dialStart = startTick;
    this.lowSignalStreak = 0;
    this.pendingLost = false;
  }

  disconnect(): { state: 'idle' } {
    if (this.gateState === 'idle') {
      return { state: 'idle' };
    }
    try {
      this.hardware.releaseDialer();
    } catch {
      throw new StationError('HARDWARE_FAILURE', 'release failed');
    }
    this.toIdle();
    if (this.activeWindow) {
      this.activeWindow.status = 'failed';
      this.activeWindow.reason = 'CONNECTION_LOST';
      this.activeWindow = null;
    }
    return { state: 'idle' };
  }

  setShield(state: unknown): { state: 'open' | 'closed' } {
    if (state !== 'open' && state !== 'closed') {
      throw new StationError('INVALID_REQUEST', 'state must be open or closed');
    }
    if (state !== this.shield) {
      try {
        this.hardware.setShield(state === 'closed');
      } catch {
        throw new StationError('HARDWARE_FAILURE', 'shield actuator failed');
      }
      this.shield = state;
    }
    return { state: this.shield };
  }

  transmit(payloadBytes: unknown): { sentBytes: number } {
    if (typeof payloadBytes !== 'number' || !Number.isInteger(payloadBytes) || payloadBytes < 1) {
      throw new StationError('INVALID_REQUEST', 'payloadBytes must be an integer >= 1');
    }
    if (this.pendingLost) {
      this.pendingLost = false;
      throw new StationError('CONNECTION_LOST', 'the connection was lost');
    }
    if (this.gateState !== 'connected') {
      throw new StationError('NOT_CONNECTED', 'no outgoing connection');
    }
    if (this.shield === 'closed') {
      throw new StationError('SHIELD_CLOSED', 'shield is closed');
    }
    try {
      this.hardware.sendPayload(payloadBytes);
    } catch {
      throw new StationError('HARDWARE_FAILURE', 'transmitter failed');
    }
    this.sentBytes += payloadBytes;
    return { sentBytes: payloadBytes };
  }

  planWindow(address: unknown, startTick: unknown, duration: unknown): { id: string } {
    if (
      typeof address !== 'string' ||
      typeof startTick !== 'number' ||
      !Number.isInteger(startTick) ||
      startTick <= this.tick ||
      typeof duration !== 'number' ||
      !Number.isInteger(duration) ||
      duration < 1
    ) {
      throw new StationError('INVALID_REQUEST', 'invalid window');
    }
    const gate = this.dialableGate(address);
    const end = startTick + DIAL_TICKS + duration;
    const conflict = this.windows.some(
      (w) =>
        (w.status === 'scheduled' || w.status === 'active') &&
        startTick < w.startTick + DIAL_TICKS + w.duration &&
        w.startTick < end,
    );
    if (conflict) {
      throw new StationError('SCHEDULE_CONFLICT', 'window overlaps another window');
    }
    const forecast = Math.min(CAPACITY, this.energy + RECHARGE * (startTick - this.tick));
    const needed = dialCost(gate.distanceClass) + holdingCost(gate.distanceClass) * duration;
    if (forecast < needed) {
      throw new StationError(
        'INSUFFICIENT_ENERGY',
        `window needs ${needed} EU, forecast ${forecast}`,
      );
    }
    const id = `w${this.windows.length + 1}`;
    this.windows.push({ id, address, startTick, duration, status: 'scheduled', connectedTicks: 0 });
    return { id };
  }

  listWindows(): Array<Record<string, unknown>> {
    return [...this.windows]
      .sort((a, b) => a.startTick - b.startTick)
      .map((w) => {
        const base: Record<string, unknown> = {
          id: w.id,
          address: w.address,
          startTick: w.startTick,
          duration: w.duration,
          status: w.status,
        };
        if (w.reason !== undefined) {
          base['reason'] = w.reason;
        }
        return base;
      });
  }

  status(): Record<string, unknown> {
    return {
      tick: this.tick,
      energy: this.energy,
      gateState: this.gateState,
      shield: this.shield,
      remoteAddress: this.remote,
      droppedTransmissions: this.droppedTransmissions,
      sentBytes: this.sentBytes,
    };
  }

  telemetry(last: number): { frames: StoredFrame[]; averageSignalQuality: number | null } {
    const frames = this.frames.slice(-last);
    const average =
      frames.length === 0
        ? null
        : frames.reduce((acc, f) => acc + f.signalQuality, 0) / frames.length;
    return { frames, averageSignalQuality: average };
  }

  advance(count: number): { tick: number; events: StationEvent[] } {
    const events: StationEvent[] = [];
    for (let i = 0; i < count; i += 1) {
      this.step(events);
    }
    return { tick: this.tick, events };
  }

  private toIdle(): void {
    this.gateState = 'idle';
    this.remote = null;
    this.remoteClass = 0;
    this.lowSignalStreak = 0;
  }

  private endBySelf(): void {
    try {
      this.hardware.releaseDialer();
    } catch {
      // Ignored by specification: the connection ends anyway.
    }
    this.toIdle();
  }

  private failActiveWindow(events: StationEvent[], t: number): void {
    if (this.activeWindow) {
      this.activeWindow.status = 'failed';
      this.activeWindow.reason = 'CONNECTION_LOST';
      events.push({
        tick: t,
        type: 'WINDOW_FAILED',
        windowId: this.activeWindow.id,
        reason: 'CONNECTION_LOST',
      });
      this.activeWindow = null;
    }
  }

  private step(events: StationEvent[]): void {
    this.tick += 1;
    const t = this.tick;

    const call = this.hardware.pollIncoming();
    if (call) {
      if (this.gateState === 'idle') {
        this.gateState = 'incoming';
        this.remote = call.address;
        this.incomingStart = t;
        this.incomingDuration = call.durationTicks;
        this.lowSignalStreak = 0;
        events.push({ tick: t, type: 'INCOMING_CONNECTION', address: call.address });
      } else {
        events.push({ tick: t, type: 'INCOMING_REJECTED', address: call.address });
      }
    }

    if (this.gateState === 'dialing' && t === this.dialStart + DIAL_TICKS) {
      this.gateState = 'connected';
      events.push({ tick: t, type: 'CONNECTED', address: this.remote });
    }

    if (this.gateState === 'connected' || this.gateState === 'incoming') {
      let quality = 0;
      try {
        const frame = this.hardware.readTelemetry();
        this.frames.push({
          tick: t,
          signalQuality: frame.signalQuality,
          temperature: frame.temperature,
          payloadBytes: frame.payloadBytes,
        });
        quality = frame.signalQuality;
        if (this.shield === 'closed' && frame.payloadBytes > 0) {
          this.droppedTransmissions += 1;
        }
      } catch {
        quality = 0;
      }
      this.lowSignalStreak = quality < LOW_SIGNAL ? this.lowSignalStreak + 1 : 0;
      if (this.lowSignalStreak >= 2) {
        const outgoing = this.gateState === 'connected';
        const address = this.remote;
        this.endBySelf();
        events.push({ tick: t, type: 'CONNECTION_LOST', address });
        if (outgoing) {
          this.pendingLost = true;
          this.failActiveWindow(events, t);
        }
      }
    }

    let energy = this.energy;
    if (this.gateState === 'connected') {
      energy -= holdingCost(this.remoteClass);
    }
    if (this.shield === 'closed') {
      energy -= SHIELD_COST;
    }
    if (this.gateState === 'idle') {
      energy += RECHARGE;
    }
    energy = Math.min(CAPACITY, energy);
    if (energy < 0 && this.gateState === 'connected') {
      const address = this.remote;
      this.energy = 0;
      this.endBySelf();
      this.pendingLost = true;
      events.push({ tick: t, type: 'ENERGY_DEPLETED', address });
      this.failActiveWindow(events, t);
    } else {
      this.energy = Math.max(0, energy);
    }

    if (this.gateState === 'incoming' && t - this.incomingStart + 1 >= this.incomingDuration) {
      const address = this.remote;
      this.endBySelf();
      events.push({ tick: t, type: 'INCOMING_ENDED', address });
    }

    if (this.activeWindow && this.gateState === 'connected') {
      this.activeWindow.connectedTicks += 1;
      if (this.activeWindow.connectedTicks >= this.activeWindow.duration) {
        this.endBySelf();
        this.activeWindow.status = 'completed';
        events.push({ tick: t, type: 'WINDOW_COMPLETED', windowId: this.activeWindow.id });
        this.activeWindow = null;
      }
    }

    const due = this.windows.find((w) => w.status === 'scheduled' && w.startTick === t);
    if (due) {
      try {
        this.startDial(due.address, t);
        due.status = 'active';
        this.activeWindow = due;
        events.push({ tick: t, type: 'WINDOW_STARTED', windowId: due.id });
      } catch (error) {
        const reason = error instanceof StationError ? error.code : 'HARDWARE_FAILURE';
        due.status = 'failed';
        due.reason = reason;
        events.push({ tick: t, type: 'WINDOW_FAILED', windowId: due.id, reason });
      }
    }
  }
}
