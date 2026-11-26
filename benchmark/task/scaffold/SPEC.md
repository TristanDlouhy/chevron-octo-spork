# Gate Network Station – Specification v0.9

You are building the control core of a **gate station**: a ground station that dials remote gates of
a gate network, holds connections, manages an energy store and a protective shield, and collects
telemetry from the remote side. There is no real physics. Every number below is given; do not invent
additional rules, units or behaviour.

The station is a deterministic, tick-based system. Time advances **only** through the `POST /ticks`
endpoint. There is no wall clock and no randomness.

## 1. Deliverable

- TypeScript on Node.js 26. Use the `package.json` and `tsconfig.json` in this directory. You may add
  npm dependencies, including an HTTP framework of your choice, or use `node:http`.
- Production code goes under `src/`. You may write your own tests anywhere.
- `src/main.ts` must export exactly this function (the only fixed code contract):

```ts
import type { Hardware } from 'hardware-sim';

export interface GateDefinition {
  address: string;
  name: string;
  distanceClass: 1 | 2 | 3 | 4 | 5;
  state: 'operational' | 'decommissioned';
}

export interface StartOptions {
  port: number; // 0 = pick a free port
  gates: GateDefinition[]; // the gate registry, e.g. the content of data/gates.json
  initialEnergy: number; // integer, 0..1000
  hardware: Hardware;
}

export interface RunningStation {
  port: number; // the port actually bound
  close(): Promise<void>;
}

export function startStation(options: StartOptions): Promise<RunningStation>;
```

- The code must compile with `npx tsc --noEmit`.

## 2. Domain

### 2.1 Address

Format `LL-DDDD-C`: two upper-case letters A–Z, a hyphen, four digits 0–9, a hyphen, one upper-case
check letter. The check letter is the letter at index `(sum of the four digits) mod 26` of the
alphabet, with `A` = 0. Example: `KX-4471-Q` (4 + 4 + 7 + 1 = 16, index 16 = `Q`).

An address is **valid** if format and check letter are correct. Validation is case-sensitive and does
not trim whitespace.

### 2.2 Gate registry

The registry is the `gates` array passed to `startStation`. It is read-only at runtime. A gate is
**dialable** if its address is valid, it is in the registry and its state is `operational`. The
station's own (home) gate is not in the registry.

### 2.3 Energy

- Capacity: 1000 energy units (EU). The store holds integers between 0 and 1000.
- Dial cost: `50 + 40 × distanceClass` EU, charged once when a dial starts.
- Holding cost: `5 × distanceClass` EU per tick while an **outgoing** connection is `connected`.
- Shield cost: 2 EU per tick while the shield is `closed`.
- Recharge: +20 EU per tick while the gate state is `idle`, capped at 1000.
- Incoming connections cost nothing.

### 2.4 Gate state

One connection at a time. States:

| State       | Meaning                                          |
| ----------- | ------------------------------------------------ |
| `idle`      | no connection                                    |
| `dialing`   | outgoing dial in progress; lasts exactly 3 ticks |
| `connected` | outgoing connection established                  |
| `incoming`  | a remote gate has connected to this station      |

Transitions:

- `idle` → `dialing`: successful `POST /connection` or a schedule window starting.
- `dialing` → `connected`: 3 ticks after the dial started.
- `connected` → `idle`: `DELETE /connection`, connection lost, energy depleted, or the end of a
  schedule window.
- `dialing` → `idle`: `DELETE /connection` (the dial cost is not refunded).
- `idle` → `incoming`: the hardware reports an incoming call.
- `incoming` → `idle`: `DELETE /connection`, the incoming call's duration has elapsed, or connection
  lost.

### 2.5 Shield

`open` or `closed`, initially `open`. While closed, outgoing transmissions fail with
`SHIELD_CLOSED`, and every telemetry frame with `payloadBytes > 0` counts as one **dropped
transmission**.

### 2.6 Telemetry

While the state is `connected` or `incoming`, the station reads one telemetry frame per tick from
the hardware. Frames are stored in order (all connections, never cleared). If `signalQuality` is
below 20 in **two consecutive ticks** of the same connection, the connection is lost. If reading
telemetry throws, no frame is stored and the tick counts as `signalQuality` 0.

### 2.7 Schedule windows

A window `{ address, startTick, duration }` reserves a future outgoing connection.

- `startTick` must be an integer greater than the current tick; `duration` an integer ≥ 1.
- A window occupies the ticks `[startTick, startTick + 3 + duration)` (3 dialing ticks plus the
  connected ticks). Two scheduled or active windows must not overlap.
- Energy forecast at planning time: `min(1000, energy + 20 × (startTick − currentTick))` must be at
  least `dialCost + holdingCost × duration`. The forecast assumes the station stays idle with the
  shield open until `startTick` and ignores other windows.
- Window states: `scheduled` → `active` → `completed`, or `scheduled`/`active` → `failed` with a
  reason (an error code).
- At `startTick` the station dials the window's address with the same checks as `POST /connection`.
  If the dial fails, the window becomes `failed` with that error code. If it succeeds, the window is
  `active`.
- An active window ends after `duration` ticks in state `connected`: the station disconnects at the
  end of that tick and the window becomes `completed`. If the connection ends earlier for any
  reason, the window becomes `failed` with reason `CONNECTION_LOST`.
- Window IDs are `w1`, `w2`, … in creation order. Failed planning requests do not consume an ID.

## 3. Hardware

The package `hardware-sim` (in `vendor/hardware-sim`, already installed as a dependency) simulates the
gate hardware. Its interface:

```ts
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
  engageDialer(address: string): void; // may throw
  releaseDialer(): void; // may throw
  setShield(closed: boolean): void; // may throw
  sendPayload(bytes: number): void; // may throw
  readTelemetry(): TelemetryFrame; // may throw
  pollIncoming(): IncomingCall | null; // never throws
}
```

Any method marked "may throw" can throw an exception at any call. The station must never crash
because of it. Rules:

- `POST /connection`, `DELETE /connection`, `PUT /shield`, `POST /transmissions`: if the hardware
  call throws, the request fails with `HARDWARE_FAILURE` and **no state changes** (no energy is
  charged, the gate and shield states stay as they were).
- During a tick: if `releaseDialer` throws while the station ends a connection on its own, ignore
  the error and end the connection anyway. `readTelemetry` errors are handled as in 2.6. If
  `engageDialer` throws for a starting window, the window fails with `HARDWARE_FAILURE`.

Call the hardware exactly as follows and at no other time:

- `engageDialer(address)` once per dial attempt that passed all other checks.
- `releaseDialer()` whenever a connection or dial ends (any reason, incoming included).
- `setShield(closed)` only when the shield state actually changes.
- `sendPayload(bytes)` once per transmission that passed all other checks.
- `pollIncoming()` exactly once per tick, in step 2 of the tick algorithm.
- `readTelemetry()` exactly once per tick while `connected` or `incoming` (step 4).

## 4. Tick algorithm

`POST /ticks { count }` runs the following steps `count` times. `T` is the tick number after step 1.
Each step sees the result of the previous one.

1. Increment the tick counter (it starts at 0).
2. Call `pollIncoming()`. If it returns a call and the state is `idle`, switch to `incoming` with that
   remote address and emit `INCOMING_CONNECTION`. If it returns a call in any other state, emit
   `INCOMING_REJECTED`.
3. If `dialing` and `T` equals the dial start tick plus 3 (see below), switch to `connected` and emit
   `CONNECTED`.
4. If `connected` or `incoming`: read telemetry (2.6). Count dropped transmissions (2.5). If the
   connection is lost, release the dialer, switch to `idle` and emit `CONNECTION_LOST`.
5. Energy: subtract the holding cost if `connected`, subtract the shield cost if the shield is
   closed, add the recharge if `idle`, cap at 1000. If the result is below 0 while `connected`, set
   energy to 0, release the dialer, switch to `idle` and emit `ENERGY_DEPLETED`. In any other state
   a result below 0 is set to 0.
6. If `incoming` and the call has lasted `durationTicks` ticks (counting the tick it started), release
   the dialer, switch to `idle` and emit `INCOMING_ENDED`.
7. If an active window has now spent `duration` ticks in `connected`, release the dialer, switch to
   `idle`, mark the window `completed` and emit `WINDOW_COMPLETED`.
8. If a scheduled window has `startTick == T`, try to dial it. Emit `WINDOW_STARTED` on success or
   `WINDOW_FAILED` with the error code otherwise.

If a connection that belongs to an active window ends in step 4 or 5, the window is marked `failed`
with reason `CONNECTION_LOST` and `WINDOW_FAILED` is emitted directly after `CONNECTION_LOST` or
`ENERGY_DEPLETED`. If it ends through `DELETE /connection`, the window is marked `failed` with
reason `CONNECTION_LOST` immediately (no event).

A dial "started" at tick `S` is the current tick when `POST /connection` succeeded, or `T` for a
window dial in step 8. It becomes `connected` in step 3 of tick `S + 3`.

After `CONNECTION_LOST` or `ENERGY_DEPLETED` of an **outgoing** connection, the next
`POST /transmissions` fails once with `CONNECTION_LOST`; after that the normal rules apply. Starting a
new dial clears this pending error.

Every event has the form `{ "tick": T, "type": "<TYPE>", ... }` with these extra fields:

| Type                  | Extra fields                      |
| --------------------- | --------------------------------- |
| `INCOMING_CONNECTION` | `address`                         |
| `INCOMING_REJECTED`   | `address`                         |
| `INCOMING_ENDED`      | `address`                         |
| `CONNECTED`           | `address`                         |
| `CONNECTION_LOST`     | `address`                         |
| `ENERGY_DEPLETED`     | `address`                         |
| `WINDOW_STARTED`      | `windowId`                        |
| `WINDOW_COMPLETED`    | `windowId`                        |
| `WINDOW_FAILED`       | `windowId`, `reason` (error code) |

## 5. HTTP API

JSON in, JSON out. A success returns the status code below and the data as the JSON body. An error
returns the status code from section 6 and the body `{ "error": { "code": "<CODE>", "message": "<text>" } }`.
The message is free text.

| Method and path                      | Body                                     | Success                                                                                                          |
| ------------------------------------ | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `GET /addresses/:address/validation` | –                                        | 200 `{ "valid": true }` or `{ "valid": false, "reason": "FORMAT" \| "CHECK_LETTER" }`                            |
| `GET /gates?state=<state>`           | –                                        | 200 array of gates in registry order; optional filter `operational` or `decommissioned`                          |
| `POST /connection`                   | `{ "address": string }`                  | 201 `{ "state": "dialing", "address": string, "energy": number }`                                                |
| `DELETE /connection`                 | –                                        | 200 `{ "state": "idle" }` (also when already idle; then no hardware call)                                        |
| `PUT /shield`                        | `{ "state": "open" \| "closed" }`        | 200 `{ "state": "open" \| "closed" }`                                                                            |
| `POST /transmissions`                | `{ "payloadBytes": integer ≥ 1 }`        | 201 `{ "sentBytes": number }`                                                                                    |
| `POST /windows`                      | `{ "address", "startTick", "duration" }` | 201 `{ "id": string }`                                                                                           |
| `GET /windows`                       | –                                        | 200 array of `{ id, address, startTick, duration, status, reason? }` sorted by `startTick`                       |
| `POST /ticks`                        | `{ "count": integer 1..1000 }`           | 200 `{ "tick": number, "events": Event[] }` (events of all `count` ticks in order)                               |
| `GET /status`                        | –                                        | 200 `{ tick, energy, gateState, shield, remoteAddress, droppedTransmissions, sentBytes }`                        |
| `GET /telemetry?last=<k>`            | –                                        | 200 `{ "frames": [{ tick, signalQuality, temperature, payloadBytes }], "averageSignalQuality": number \| null }` |

Details:

- `GET /telemetry`: `last` is an integer 1..50, default 10. Returns the newest `k` frames, oldest
  first. `averageSignalQuality` is the mean over the returned frames, or `null` if there are none.
- `GET /status`: `remoteAddress` is the address of the current connection or dial, otherwise `null`.
  `sentBytes` is the total of all successful transmissions.
- `GET /addresses/:address/validation` reports `FORMAT` before `CHECK_LETTER`.

## 6. Error codes

Checks run in the order listed per endpoint below; the first failing check wins.

| Code                  | HTTP | When                                                                 |
| --------------------- | ---- | -------------------------------------------------------------------- |
| `INVALID_REQUEST`     | 400  | missing or malformed body or query field                             |
| `INVALID_ADDRESS`     | 400  | address format or check letter wrong                                 |
| `UNKNOWN_GATE`        | 404  | valid address not in the registry, or decommissioned                 |
| `GATE_ALREADY_ACTIVE` | 409  | dial while the state is not `idle`                                   |
| `INSUFFICIENT_ENERGY` | 409  | energy below the dial cost, or the forecast (2.7) too low            |
| `SCHEDULE_CONFLICT`   | 409  | window overlaps a scheduled or active window                         |
| `NOT_CONNECTED`       | 409  | transmission while not `connected`                                   |
| `SHIELD_CLOSED`       | 409  | transmission while the shield is closed                              |
| `CONNECTION_LOST`     | 409  | first transmission after an outgoing connection was lost (section 4) |
| `HARDWARE_FAILURE`    | 502  | the hardware threw (section 3)                                       |

Check order:

- `POST /connection`: `INVALID_REQUEST`, `INVALID_ADDRESS`, `UNKNOWN_GATE`, `GATE_ALREADY_ACTIVE`,
  `INSUFFICIENT_ENERGY`, `HARDWARE_FAILURE`.
- `POST /transmissions`: `INVALID_REQUEST`, `CONNECTION_LOST`, `NOT_CONNECTED`, `SHIELD_CLOSED`,
  `HARDWARE_FAILURE`.
- `POST /windows`: `INVALID_REQUEST`, `INVALID_ADDRESS`, `UNKNOWN_GATE`, `SCHEDULE_CONFLICT`,
  `INSUFFICIENT_ENERGY`.
- `PUT /shield`, `DELETE /connection`: `INVALID_REQUEST` (shield only), `HARDWARE_FAILURE`.
- `POST /ticks`, `GET /telemetry`, `GET /gates`: `INVALID_REQUEST`.

## 7. Example scenarios

Each scenario starts a fresh station with `data/gates.json`, `initialEnergy` 1000 and a hardware
script as noted. `→` shows the response status and the relevant part of the body.

1. **Dial and connect.** Empty script. `POST /connection {"address":"KX-4471-Q"}` → 201, energy
   `1000 − (50 + 40 × 2) = 870`. `POST /ticks {"count":3}` → events contain
   `{"tick":3,"type":"CONNECTED","address":"KX-4471-Q"}`. `GET /status` → `gateState` `connected`,
   energy `860` (one tick of holding cost 10).
2. **Invalid address.** `POST /connection {"address":"KX-4471-A"}` → 400 `INVALID_ADDRESS`.
   `GET /addresses/KX-4471-A/validation` → `{"valid":false,"reason":"CHECK_LETTER"}`.
3. **Not enough energy.** `initialEnergy` 100. `POST /connection {"address":"MB-9900-S"}`
   (distance class 5, cost 250) → 409 `INSUFFICIENT_ENERGY`.
4. **Shield.** Connect as in 1. `PUT /shield {"state":"closed"}` → 200.
   `POST /transmissions {"payloadBytes":64}` → 409 `SHIELD_CLOSED`.
5. **Signal loss.** Script: telemetry `signalQuality` 10 from tick 4 on. Connect as in 1, then
   `POST /ticks {"count":3}` → events contain `CONNECTION_LOST` at tick 5 (ticks 4 and 5 are below 20).
   `POST /transmissions {"payloadBytes":1}` → 409 `CONNECTION_LOST`, a second call → 409
   `NOT_CONNECTED`.
6. **Schedule window.** `POST /windows {"address":"KX-4471-Q","startTick":2,"duration":2}` → 201
   `{"id":"w1"}`. `POST /ticks {"count":7}` → `WINDOW_STARTED` at tick 2, `CONNECTED` at tick 5,
   `WINDOW_COMPLETED` at tick 6; `GET /status` → `idle`.

The hardware script format is documented in `vendor/hardware-sim/README.md`.
