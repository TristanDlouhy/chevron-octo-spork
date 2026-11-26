# hardware-sim

Deterministic simulator of the gate hardware. Create it with `createSimulatedHardware(script)`.

The simulator counts ticks by counting `pollIncoming()` calls, so the station must call
`pollIncoming()` exactly once per tick.

```ts
import { createSimulatedHardware } from 'hardware-sim';

const hardware = createSimulatedHardware({
  // An incoming call reported by pollIncoming() in tick 4, lasting 3 ticks.
  incoming: [{ tick: 4, address: 'TA-1203-G', durationTicks: 3 }],
  // From tick 6 on, every frame has signalQuality 10 (other fields keep their defaults).
  telemetry: [{ fromTick: 6, signalQuality: 10 }],
  // The 1st and 3rd call of sendPayload throw a HardwareFault.
  failures: [{ method: 'sendPayload', calls: [1, 3] }],
});
```

Telemetry defaults: `signalQuality` 100, `temperature` 20, `payloadBytes` 0. For a read in tick `T`
all entries with `fromTick <= T` are applied in order of `fromTick`, each overriding only the fields
it sets.

`hardware.log` lists every call with the tick it happened in.
