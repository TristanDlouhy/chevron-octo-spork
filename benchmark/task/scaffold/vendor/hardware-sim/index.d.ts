export interface TelemetryFrame {
  signalQuality: number;
  temperature: number;
  payloadBytes: number;
}

export interface IncomingCall {
  address: string;
  durationTicks: number;
}

export interface Hardware {
  /** May throw. */
  engageDialer(address: string): void;
  /** May throw. */
  releaseDialer(): void;
  /** May throw. */
  setShield(closed: boolean): void;
  /** May throw. */
  sendPayload(bytes: number): void;
  /** May throw. */
  readTelemetry(): TelemetryFrame;
  /** Never throws. Must be called exactly once per tick. */
  pollIncoming(): IncomingCall | null;
}

export type HardwareMethod =
  'engageDialer' | 'releaseDialer' | 'setShield' | 'sendPayload' | 'readTelemetry' | 'pollIncoming';

export interface HardwareScript {
  /** Incoming calls, reported by pollIncoming() in the given tick. */
  incoming?: ReadonlyArray<{ tick: number; address: string; durationTicks: number }>;
  /**
   * Telemetry overrides. For a read in tick T all entries with fromTick <= T are applied in
   * order of fromTick, each overriding only the fields it sets.
   * Defaults: signalQuality 100, temperature 20, payloadBytes 0.
   */
  telemetry?: ReadonlyArray<{
    fromTick: number;
    signalQuality?: number;
    temperature?: number;
    payloadBytes?: number;
  }>;
  /** Make the n-th call (1-based, counted per method) of a method throw a HardwareFault. */
  failures?: ReadonlyArray<{
    method: Exclude<HardwareMethod, 'pollIncoming'>;
    calls: readonly number[];
  }>;
}

export interface HardwareCall {
  /** Number of pollIncoming() calls so far, i.e. the station tick. */
  tick: number;
  method: HardwareMethod;
  args: readonly unknown[];
  threw: boolean;
}

export interface SimulatedHardware extends Hardware {
  /** Every call in order, including failed ones. */
  readonly log: readonly HardwareCall[];
}

export declare class HardwareFault extends Error {
  readonly method: HardwareMethod;
}

export declare function createSimulatedHardware(script?: HardwareScript): SimulatedHardware;
