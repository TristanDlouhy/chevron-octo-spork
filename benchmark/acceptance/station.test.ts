// Hidden acceptance tests for the gate station task. Agents never see this file.
// Every test checks one rule of SPEC.md; the ID prefix (T01 …) is stable across versions.
import { afterEach, describe, expect, test } from 'vitest';
import { boot, calls, closeAll, eventsOf, type TestStation } from './harness.js';

afterEach(closeAll);

const NORTH = 'KX-4471-Q'; // class 2, dial 130, hold 10
const BEACON = 'MB-9900-S'; // class 5, dial 250, hold 25
const HARBOR = 'TA-1203-G'; // class 1, dial 90, hold 5
const SPIRE = 'LO-0007-H'; // decommissioned
const NOWHERE = 'AA-0000-A'; // valid, not in registry

async function connected(s: TestStation, address = NORTH): Promise<void> {
  expect((await s.post('/connection', { address })).status).toBe(201);
  await s.ticks(3);
}

describe('addresses', () => {
  test('T01 a correct address is valid', async () => {
    const s = await boot();
    expect((await s.get(`/addresses/${NORTH}/validation`)).body).toEqual({ valid: true });
  });

  test('T02 lower-case letters are a FORMAT error', async () => {
    const s = await boot();
    expect((await s.get('/addresses/kx-4471-Q/validation')).body).toEqual({
      valid: false,
      reason: 'FORMAT',
    });
  });

  test('T03 a wrong check letter is a CHECK_LETTER error', async () => {
    const s = await boot();
    expect((await s.get('/addresses/KX-4471-A/validation')).body).toEqual({
      valid: false,
      reason: 'CHECK_LETTER',
    });
  });

  test('T04 whitespace is not trimmed', async () => {
    const s = await boot();
    expect((await s.get(`/addresses/%20${NORTH}/validation`)).body).toEqual({
      valid: false,
      reason: 'FORMAT',
    });
  });
});

describe('registry', () => {
  test('T05 lists all gates in registry order', async () => {
    const s = await boot();
    const r = await s.get('/gates');
    expect(r.status).toBe(200);
    expect(r.body.map((g: any) => g.address)).toEqual([
      NORTH,
      BEACON,
      HARBOR,
      'RV-5550-P',
      SPIRE,
      'QE-3318-P',
      'ZN-8642-U',
      'DW-2025-J',
    ]);
  });

  test('T06 filters by state', async () => {
    const s = await boot();
    const r = await s.get('/gates?state=decommissioned');
    expect(r.body.map((g: any) => g.address)).toEqual([SPIRE, 'DW-2025-J']);
  });

  test('T07 rejects an unknown state filter', async () => {
    const s = await boot();
    const r = await s.get('/gates?state=broken');
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('INVALID_REQUEST');
  });
});

describe('dialing', () => {
  test('T08 a dial starts, charges the dial cost and reports dialing', async () => {
    const s = await boot();
    const r = await s.post('/connection', { address: NORTH });
    expect(r.status).toBe(201);
    expect(r.body).toEqual({ state: 'dialing', address: NORTH, energy: 870 });
  });

  test('T09 the gate connects in the third tick', async () => {
    const s = await boot();
    await s.post('/connection', { address: NORTH });
    const r = await s.ticks(3);
    expect(r.body.events).toContainEqual({ tick: 3, type: 'CONNECTED', address: NORTH });
    expect((await s.status()).gateState).toBe('connected');
  });

  test('T10 an invalid address is rejected', async () => {
    const s = await boot();
    const r = await s.post('/connection', { address: 'KX-4471-A' });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('INVALID_ADDRESS');
  });

  test('T11 a valid address outside the registry is UNKNOWN_GATE', async () => {
    const s = await boot();
    const r = await s.post('/connection', { address: NOWHERE });
    expect(r.status).toBe(404);
    expect(r.body.error.code).toBe('UNKNOWN_GATE');
  });

  test('T12 a decommissioned gate is UNKNOWN_GATE', async () => {
    const s = await boot();
    const r = await s.post('/connection', { address: SPIRE });
    expect(r.status).toBe(404);
    expect(r.body.error.code).toBe('UNKNOWN_GATE');
  });

  test('T13 dialing while active is GATE_ALREADY_ACTIVE', async () => {
    const s = await boot();
    await s.post('/connection', { address: NORTH });
    const r = await s.post('/connection', { address: HARBOR });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('GATE_ALREADY_ACTIVE');
  });

  test('T14 too little energy is INSUFFICIENT_ENERGY', async () => {
    const s = await boot({ initialEnergy: 100 });
    const r = await s.post('/connection', { address: BEACON });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('INSUFFICIENT_ENERGY');
    expect(calls(s.hw, 'engageDialer')).toBe(0);
  });

  test('T15 energy exactly equal to the dial cost is enough', async () => {
    const s = await boot({ initialEnergy: 250 });
    const r = await s.post('/connection', { address: BEACON });
    expect(r.status).toBe(201);
    expect(r.body.energy).toBe(0);
  });

  test('T16 a dialer fault fails the request without any state change', async () => {
    const s = await boot({ script: { failures: [{ method: 'engageDialer', calls: [1] }] } });
    const r = await s.post('/connection', { address: NORTH });
    expect(r.status).toBe(502);
    expect(r.body.error.code).toBe('HARDWARE_FAILURE');
    const st = await s.status();
    expect(st.gateState).toBe('idle');
    expect(st.energy).toBe(1000);
  });

  test('T17 a missing address is INVALID_REQUEST', async () => {
    const s = await boot();
    const r = await s.post('/connection', {});
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('INVALID_REQUEST');
  });

  test('T18 UNKNOWN_GATE is checked before GATE_ALREADY_ACTIVE', async () => {
    const s = await boot();
    await s.post('/connection', { address: NORTH });
    const r = await s.post('/connection', { address: SPIRE });
    expect(r.body.error.code).toBe('UNKNOWN_GATE');
  });

  test('T19 status reports the remote address while dialing', async () => {
    const s = await boot();
    await s.post('/connection', { address: NORTH });
    expect((await s.status()).remoteAddress).toBe(NORTH);
  });
});

describe('energy', () => {
  test('T20 holding cost is charged per connected tick', async () => {
    const s = await boot();
    await connected(s);
    await s.ticks(2);
    expect((await s.status()).energy).toBe(870 - 3 * 10);
  });

  test('T21 recharge while idle is capped at 1000', async () => {
    const s = await boot({ initialEnergy: 990 });
    await s.ticks(2);
    expect((await s.status()).energy).toBe(1000);
  });

  test('T22 a closed shield costs 2 per tick on top of recharge', async () => {
    const s = await boot({ initialEnergy: 500 });
    await s.put('/shield', { state: 'closed' });
    await s.ticks(2);
    expect((await s.status()).energy).toBe(536);
  });

  test('T23 there is no recharge while dialing', async () => {
    const s = await boot();
    await s.post('/connection', { address: NORTH });
    await s.ticks(2);
    expect((await s.status()).energy).toBe(870);
  });

  test('T24 running out of energy ends the connection', async () => {
    const s = await boot({ initialEnergy: 150 });
    await s.post('/connection', { address: NORTH });
    const r = await s.ticks(5);
    expect(r.body.events).toContainEqual({ tick: 5, type: 'ENERGY_DEPLETED', address: NORTH });
    const st = await s.status();
    expect(st.energy).toBe(0);
    expect(st.gateState).toBe('idle');
  });

  test('T25 incoming connections cost nothing and do not recharge', async () => {
    const s = await boot({
      initialEnergy: 500,
      script: { incoming: [{ tick: 1, address: HARBOR, durationTicks: 5 }] },
    });
    await s.ticks(3);
    expect((await s.status()).energy).toBe(500);
  });
});

describe('disconnect', () => {
  test('T26 disconnecting a connection releases the dialer', async () => {
    const s = await boot();
    await connected(s);
    const r = await s.del('/connection');
    expect(r).toEqual({ status: 200, body: { state: 'idle' } });
    expect(calls(s.hw, 'releaseDialer')).toBe(1);
  });

  test('T27 disconnecting while idle calls no hardware', async () => {
    const s = await boot();
    const r = await s.del('/connection');
    expect(r).toEqual({ status: 200, body: { state: 'idle' } });
    expect(calls(s.hw, 'releaseDialer')).toBe(0);
  });

  test('T28 a release fault keeps the connection', async () => {
    const s = await boot({ script: { failures: [{ method: 'releaseDialer', calls: [1] }] } });
    await connected(s);
    const r = await s.del('/connection');
    expect(r.status).toBe(502);
    expect((await s.status()).gateState).toBe('connected');
  });

  test('T29 aborting a dial does not refund the dial cost', async () => {
    const s = await boot();
    await s.post('/connection', { address: NORTH });
    await s.del('/connection');
    expect((await s.status()).energy).toBe(870);
  });
});

describe('shield', () => {
  test('T30 closing the shield drives the actuator', async () => {
    const s = await boot();
    const r = await s.put('/shield', { state: 'closed' });
    expect(r).toEqual({ status: 200, body: { state: 'closed' } });
    expect(s.hw.log.filter((c) => c.method === 'setShield').map((c) => c.args)).toEqual([[true]]);
  });

  test('T31 setting the current state calls no hardware', async () => {
    const s = await boot();
    await s.put('/shield', { state: 'open' });
    expect(calls(s.hw, 'setShield')).toBe(0);
  });

  test('T32 an actuator fault keeps the shield state', async () => {
    const s = await boot({ script: { failures: [{ method: 'setShield', calls: [1] }] } });
    const r = await s.put('/shield', { state: 'closed' });
    expect(r.status).toBe(502);
    expect((await s.status()).shield).toBe('open');
  });

  test('T33 an unknown shield state is INVALID_REQUEST', async () => {
    const s = await boot();
    const r = await s.put('/shield', { state: 'half' });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('INVALID_REQUEST');
  });
});

describe('transmissions', () => {
  test('T34 a transmission succeeds and adds to sentBytes', async () => {
    const s = await boot();
    await connected(s);
    expect(await s.post('/transmissions', { payloadBytes: 64 })).toEqual({
      status: 201,
      body: { sentBytes: 64 },
    });
    await s.post('/transmissions', { payloadBytes: 6 });
    expect((await s.status()).sentBytes).toBe(70);
  });

  test('T35 transmitting while dialing is NOT_CONNECTED', async () => {
    const s = await boot();
    await s.post('/connection', { address: NORTH });
    const r = await s.post('/transmissions', { payloadBytes: 1 });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('NOT_CONNECTED');
  });

  test('T36 transmitting with a closed shield is SHIELD_CLOSED', async () => {
    const s = await boot();
    await connected(s);
    await s.put('/shield', { state: 'closed' });
    const r = await s.post('/transmissions', { payloadBytes: 64 });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('SHIELD_CLOSED');
  });

  test('T37 a payload of 0 bytes is INVALID_REQUEST', async () => {
    const s = await boot();
    await connected(s);
    const r = await s.post('/transmissions', { payloadBytes: 0 });
    expect(r.status).toBe(400);
  });

  test('T38 a transmitter fault does not count the bytes', async () => {
    const s = await boot({ script: { failures: [{ method: 'sendPayload', calls: [1] }] } });
    await connected(s);
    const r = await s.post('/transmissions', { payloadBytes: 10 });
    expect(r.status).toBe(502);
    expect((await s.status()).sentBytes).toBe(0);
  });

  test('T39 after a lost connection the next transmission fails once with CONNECTION_LOST', async () => {
    const s = await boot({ script: { telemetry: [{ fromTick: 4, signalQuality: 10 }] } });
    await connected(s);
    const r = await s.ticks(3);
    expect(r.body.events).toContainEqual({ tick: 5, type: 'CONNECTION_LOST', address: NORTH });
    expect((await s.post('/transmissions', { payloadBytes: 1 })).body.error.code).toBe(
      'CONNECTION_LOST',
    );
    expect((await s.post('/transmissions', { payloadBytes: 1 })).body.error.code).toBe(
      'NOT_CONNECTED',
    );
  });

  test('T40 a new dial clears the pending CONNECTION_LOST', async () => {
    const s = await boot({
      script: {
        telemetry: [
          { fromTick: 4, signalQuality: 10 },
          { fromTick: 6, signalQuality: 100 },
        ],
      },
    });
    await connected(s);
    await s.ticks(2);
    await connected(s);
    expect((await s.post('/transmissions', { payloadBytes: 1 })).status).toBe(201);
  });
});

describe('telemetry', () => {
  test('T41 frames are stored with their tick and averaged', async () => {
    const s = await boot({
      script: { telemetry: [{ fromTick: 4, signalQuality: 50, temperature: 31 }] },
    });
    await connected(s);
    await s.ticks(1);
    const r = await s.get('/telemetry?last=2');
    expect(r.body).toEqual({
      frames: [
        { tick: 3, signalQuality: 100, temperature: 20, payloadBytes: 0 },
        { tick: 4, signalQuality: 50, temperature: 31, payloadBytes: 0 },
      ],
      averageSignalQuality: 75,
    });
  });

  test('T42 last defaults to 10 and returns the newest frames', async () => {
    const s = await boot();
    await connected(s);
    await s.ticks(11);
    const frames = (await s.get('/telemetry')).body.frames;
    expect(frames).toHaveLength(10);
    expect(frames[0].tick).toBe(5);
    expect(frames[9].tick).toBe(14);
  });

  test('T43 without frames the average is null', async () => {
    const s = await boot();
    expect((await s.get('/telemetry')).body).toEqual({ frames: [], averageSignalQuality: null });
  });

  test('T44 last outside 1..50 is INVALID_REQUEST', async () => {
    const s = await boot();
    expect((await s.get('/telemetry?last=0')).status).toBe(400);
    expect((await s.get('/telemetry?last=51')).status).toBe(400);
  });

  test('T45 a single low tick does not lose the connection', async () => {
    const s = await boot({
      script: {
        telemetry: [
          { fromTick: 4, signalQuality: 10 },
          { fromTick: 5, signalQuality: 100 },
        ],
      },
    });
    await connected(s);
    const r = await s.ticks(3);
    expect(eventsOf(r, 'CONNECTION_LOST')).toEqual([]);
  });

  test('T46 telemetry read faults count as quality 0 and store no frame', async () => {
    const s = await boot({ script: { failures: [{ method: 'readTelemetry', calls: [1, 2] }] } });
    await s.post('/connection', { address: NORTH });
    const r = await s.ticks(4);
    expect(r.body.events).toContainEqual({ tick: 4, type: 'CONNECTION_LOST', address: NORTH });
    expect((await s.get('/telemetry')).body.frames).toEqual([]);
  });

  test('T47 frames with payload are dropped while the shield is closed', async () => {
    const s = await boot({ script: { telemetry: [{ fromTick: 1, payloadBytes: 5 }] } });
    await connected(s);
    await s.put('/shield', { state: 'closed' });
    await s.ticks(2);
    expect((await s.status()).droppedTransmissions).toBe(2);
  });

  test('T48 a release fault during signal loss is ignored', async () => {
    const s = await boot({
      script: {
        telemetry: [{ fromTick: 4, signalQuality: 0 }],
        failures: [{ method: 'releaseDialer', calls: [1] }],
      },
    });
    await connected(s);
    await s.ticks(2);
    expect((await s.status()).gateState).toBe('idle');
  });
});

describe('incoming', () => {
  test('T49 an incoming call connects an idle gate', async () => {
    const s = await boot({
      script: { incoming: [{ tick: 2, address: HARBOR, durationTicks: 3 }] },
    });
    const r = await s.ticks(2);
    expect(r.body.events).toContainEqual({ tick: 2, type: 'INCOMING_CONNECTION', address: HARBOR });
    expect((await s.status()).gateState).toBe('incoming');
  });

  test('T50 an incoming call ends after its duration', async () => {
    const s = await boot({
      script: { incoming: [{ tick: 2, address: HARBOR, durationTicks: 3 }] },
    });
    const r = await s.ticks(5);
    expect(eventsOf(r, 'INCOMING_ENDED')).toEqual([
      { tick: 4, type: 'INCOMING_ENDED', address: HARBOR },
    ]);
    expect(calls(s.hw, 'releaseDialer')).toBe(1);
  });

  test('T51 an incoming call while dialing is rejected', async () => {
    const s = await boot({
      script: { incoming: [{ tick: 1, address: HARBOR, durationTicks: 3 }] },
    });
    await s.post('/connection', { address: NORTH });
    const r = await s.ticks(1);
    expect(r.body.events).toContainEqual({ tick: 1, type: 'INCOMING_REJECTED', address: HARBOR });
    expect((await s.status()).gateState).toBe('dialing');
  });

  test('T52 dialing during an incoming call is GATE_ALREADY_ACTIVE', async () => {
    const s = await boot({
      script: { incoming: [{ tick: 1, address: HARBOR, durationTicks: 5 }] },
    });
    await s.ticks(1);
    expect((await s.post('/connection', { address: NORTH })).body.error.code).toBe(
      'GATE_ALREADY_ACTIVE',
    );
  });

  test('T53 transmitting during an incoming call is NOT_CONNECTED', async () => {
    const s = await boot({
      script: { incoming: [{ tick: 1, address: HARBOR, durationTicks: 5 }] },
    });
    await s.ticks(1);
    expect((await s.post('/transmissions', { payloadBytes: 1 })).body.error.code).toBe(
      'NOT_CONNECTED',
    );
  });
});

describe('schedule windows', () => {
  test('T54 a window dials, connects and completes', async () => {
    const s = await boot();
    expect(await s.post('/windows', { address: NORTH, startTick: 2, duration: 2 })).toEqual({
      status: 201,
      body: { id: 'w1' },
    });
    const r = await s.ticks(7);
    expect(r.body.events).toEqual([
      { tick: 2, type: 'WINDOW_STARTED', windowId: 'w1' },
      { tick: 5, type: 'CONNECTED', address: NORTH },
      { tick: 6, type: 'WINDOW_COMPLETED', windowId: 'w1' },
    ]);
    expect((await s.status()).gateState).toBe('idle');
    expect((await s.get('/windows')).body[0].status).toBe('completed');
  });

  test('T55 overlapping windows are a SCHEDULE_CONFLICT', async () => {
    const s = await boot();
    await s.post('/windows', { address: NORTH, startTick: 2, duration: 2 });
    const r = await s.post('/windows', { address: HARBOR, startTick: 6, duration: 1 });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('SCHEDULE_CONFLICT');
  });

  test('T56 adjacent windows do not conflict', async () => {
    const s = await boot();
    await s.post('/windows', { address: NORTH, startTick: 2, duration: 2 });
    expect((await s.post('/windows', { address: HARBOR, startTick: 7, duration: 1 })).status).toBe(
      201,
    );
  });

  test('T57 a start tick in the past is INVALID_REQUEST', async () => {
    const s = await boot();
    await s.ticks(3);
    expect((await s.post('/windows', { address: NORTH, startTick: 3, duration: 1 })).status).toBe(
      400,
    );
  });

  test('T58 a too low energy forecast is INSUFFICIENT_ENERGY', async () => {
    const s = await boot({ initialEnergy: 100 });
    const r = await s.post('/windows', { address: BEACON, startTick: 5, duration: 10 });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('INSUFFICIENT_ENERGY');
  });

  test('T59 the forecast includes recharge until the start tick', async () => {
    const s = await boot({ initialEnergy: 100 });
    expect(
      (await s.post('/windows', { address: BEACON, startTick: 21, duration: 10 })).status,
    ).toBe(201);
  });

  test('T60 a window fails at start when the gate is busy', async () => {
    const s = await boot();
    await s.post('/windows', { address: HARBOR, startTick: 2, duration: 1 });
    await s.post('/connection', { address: NORTH });
    const r = await s.ticks(2);
    expect(r.body.events).toContainEqual({
      tick: 2,
      type: 'WINDOW_FAILED',
      windowId: 'w1',
      reason: 'GATE_ALREADY_ACTIVE',
    });
  });

  test('T61 windows are listed by start tick and failed planning uses no ID', async () => {
    const s = await boot();
    await s.post('/windows', { address: NORTH, startTick: 20, duration: 1 });
    await s.post('/windows', { address: SPIRE, startTick: 30, duration: 1 });
    await s.post('/windows', { address: HARBOR, startTick: 5, duration: 1 });
    const list = (await s.get('/windows')).body;
    expect(list.map((w: any) => [w.id, w.startTick, w.status])).toEqual([
      ['w2', 5, 'scheduled'],
      ['w1', 20, 'scheduled'],
    ]);
  });

  test('T62 disconnecting an active window fails it with CONNECTION_LOST', async () => {
    const s = await boot();
    await s.post('/windows', { address: NORTH, startTick: 1, duration: 5 });
    await s.ticks(4);
    await s.del('/connection');
    expect((await s.get('/windows')).body[0]).toMatchObject({
      status: 'failed',
      reason: 'CONNECTION_LOST',
    });
  });

  test('T63 signal loss during a window emits WINDOW_FAILED after CONNECTION_LOST', async () => {
    const s = await boot({ script: { telemetry: [{ fromTick: 5, signalQuality: 0 }] } });
    await s.post('/windows', { address: NORTH, startTick: 1, duration: 5 });
    const r = await s.ticks(6);
    expect(r.body.events.slice(-2)).toEqual([
      { tick: 6, type: 'CONNECTION_LOST', address: NORTH },
      { tick: 6, type: 'WINDOW_FAILED', windowId: 'w1', reason: 'CONNECTION_LOST' },
    ]);
  });
});

describe('ticks and hardware discipline', () => {
  test('T64 count outside 1..1000 is INVALID_REQUEST', async () => {
    const s = await boot();
    expect((await s.post('/ticks', { count: 0 })).status).toBe(400);
    expect((await s.post('/ticks', { count: 1001 })).status).toBe(400);
  });

  test('T65 the tick counter accumulates across requests', async () => {
    const s = await boot();
    await s.ticks(3);
    expect((await s.ticks(4)).body.tick).toBe(7);
  });

  test('T66 pollIncoming is called exactly once per tick', async () => {
    const s = await boot();
    await s.ticks(5);
    await s.ticks(2);
    expect(calls(s.hw, 'pollIncoming')).toBe(7);
  });

  test('T67 telemetry is read once per connected tick and never while idle or dialing', async () => {
    const s = await boot();
    await connected(s);
    await s.ticks(2);
    expect(calls(s.hw, 'readTelemetry')).toBe(3);
  });
});
