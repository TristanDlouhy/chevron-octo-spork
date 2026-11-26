export class HardwareFault extends Error {
  constructor(method) {
    super(`hardware fault in ${method}`);
    this.name = 'HardwareFault';
    this.method = method;
  }
}

const DEFAULT_FRAME = { signalQuality: 100, temperature: 20, payloadBytes: 0 };

export function createSimulatedHardware(script = {}) {
  const incoming = script.incoming ?? [];
  const telemetry = [...(script.telemetry ?? [])].sort((a, b) => a.fromTick - b.fromTick);
  const failures = script.failures ?? [];
  const counts = new Map();
  const log = [];
  let tick = 0;

  function call(method, args, body) {
    const n = (counts.get(method) ?? 0) + 1;
    counts.set(method, n);
    const fails = failures.some((f) => f.method === method && f.calls.includes(n));
    log.push({ tick, method, args, threw: fails });
    if (fails) {
      throw new HardwareFault(method);
    }
    return body();
  }

  return {
    log,
    engageDialer(address) {
      call('engageDialer', [address], () => undefined);
    },
    releaseDialer() {
      call('releaseDialer', [], () => undefined);
    },
    setShield(closed) {
      call('setShield', [closed], () => undefined);
    },
    sendPayload(bytes) {
      call('sendPayload', [bytes], () => undefined);
    },
    readTelemetry() {
      return call('readTelemetry', [], () => {
        let frame = { ...DEFAULT_FRAME };
        for (const entry of telemetry) {
          if (entry.fromTick <= tick) {
            const { fromTick: _ignored, ...values } = entry;
            frame = { ...frame, ...values };
          }
        }
        return frame;
      });
    },
    pollIncoming() {
      tick += 1;
      log.push({ tick, method: 'pollIncoming', args: [], threw: false });
      const found = incoming.find((c) => c.tick === tick);
      return found ? { address: found.address, durationTicks: found.durationTicks } : null;
    },
  };
}
