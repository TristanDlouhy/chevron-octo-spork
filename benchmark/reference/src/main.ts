import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Hardware } from 'hardware-sim';
import {
  Station,
  StationError,
  validateAddress,
  type ErrorCode,
  type GateDefinition,
} from './station.js';

export type { GateDefinition } from './station.js';

export interface StartOptions {
  port: number;
  gates: GateDefinition[];
  initialEnergy: number;
  hardware: Hardware;
}

export interface RunningStation {
  port: number;
  close(): Promise<void>;
}

const STATUS: Record<ErrorCode, number> = {
  INVALID_REQUEST: 400,
  INVALID_ADDRESS: 400,
  UNKNOWN_GATE: 404,
  GATE_ALREADY_ACTIVE: 409,
  INSUFFICIENT_ENERGY: 409,
  SCHEDULE_CONFLICT: 409,
  NOT_CONNECTED: 409,
  SHIELD_CLOSED: 409,
  CONNECTION_LOST: 409,
  HARDWARE_FAILURE: 502,
};

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fall through
  }
  throw new StationError('INVALID_REQUEST', 'body must be a JSON object');
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function intParam(raw: string | null, min: number, max: number, fallback: number): number {
  if (raw === null) {
    return fallback;
  }
  const value = Number(raw);
  if (!/^\d+$/.test(raw) || value < min || value > max) {
    throw new StationError('INVALID_REQUEST', 'invalid query parameter');
  }
  return value;
}

export function startStation(options: StartOptions): Promise<RunningStation> {
  const station = new Station(options.gates, options.initialEnergy, options.hardware);

  async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://station');
    const path = url.pathname;
    const method = req.method ?? 'GET';
    const validation = /^\/addresses\/([^/]+)\/validation$/.exec(path);

    if (method === 'GET' && validation) {
      return send(res, 200, validateAddress(decodeURIComponent(validation[1] ?? '')));
    }
    if (method === 'GET' && path === '/gates') {
      return send(res, 200, station.listGates(url.searchParams.get('state') ?? undefined));
    }
    if (method === 'POST' && path === '/connection') {
      const body = await readJson(req);
      if (typeof body['address'] !== 'string') {
        throw new StationError('INVALID_REQUEST', 'address must be a string');
      }
      return send(res, 201, station.dial(body['address']));
    }
    if (method === 'DELETE' && path === '/connection') {
      return send(res, 200, station.disconnect());
    }
    if (method === 'PUT' && path === '/shield') {
      const body = await readJson(req);
      return send(res, 200, station.setShield(body['state']));
    }
    if (method === 'POST' && path === '/transmissions') {
      const body = await readJson(req);
      return send(res, 201, station.transmit(body['payloadBytes']));
    }
    if (method === 'POST' && path === '/windows') {
      const body = await readJson(req);
      return send(
        res,
        201,
        station.planWindow(body['address'], body['startTick'], body['duration']),
      );
    }
    if (method === 'GET' && path === '/windows') {
      return send(res, 200, station.listWindows());
    }
    if (method === 'POST' && path === '/ticks') {
      const body = await readJson(req);
      const count = body['count'];
      if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > 1000) {
        throw new StationError('INVALID_REQUEST', 'count must be an integer 1..1000');
      }
      return send(res, 200, station.advance(count));
    }
    if (method === 'GET' && path === '/status') {
      return send(res, 200, station.status());
    }
    if (method === 'GET' && path === '/telemetry') {
      return send(res, 200, station.telemetry(intParam(url.searchParams.get('last'), 1, 50, 10)));
    }
    send(res, 404, { error: { code: 'INVALID_REQUEST', message: 'no such route' } });
  }

  const server = createServer((req, res) => {
    route(req, res).catch((error: unknown) => {
      if (error instanceof StationError) {
        send(res, STATUS[error.code], { error: { code: error.code, message: error.message } });
      } else {
        send(res, 500, { error: { code: 'INTERNAL', message: 'internal error' } });
      }
    });
  });

  return new Promise((resolve) => {
    server.listen(options.port, () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        port,
        close: () => new Promise<void>((done, fail) => server.close((e) => (e ? fail(e) : done()))),
      });
    });
  });
}
