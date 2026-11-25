import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createSimulatedHardware,
  type HardwareScript,
  type SimulatedHardware,
} from '../task/scaffold/vendor/hardware-sim/index.js';

const SOLUTION_DIR = resolve(
  process.env['SOLUTION_DIR'] ?? join(import.meta.dirname, '../reference'),
);
const GATES: unknown = JSON.parse(
  readFileSync(join(import.meta.dirname, '../task/scaffold/data/gates.json'), 'utf8'),
);

export interface Reply {
  status: number;
  body: any;
}

export interface TestStation {
  hw: SimulatedHardware;
  get(path: string): Promise<Reply>;
  post(path: string, body?: unknown): Promise<Reply>;
  put(path: string, body?: unknown): Promise<Reply>;
  del(path: string): Promise<Reply>;
  ticks(count: number): Promise<Reply>;
  status(): Promise<any>;
  close(): Promise<void>;
}

const open: TestStation[] = [];

export async function boot(
  options: { script?: HardwareScript; initialEnergy?: number } = {},
): Promise<TestStation> {
  const mod = (await import(pathToFileURL(join(SOLUTION_DIR, 'src/main.ts')).href)) as {
    startStation(o: unknown): Promise<{ port: number; close(): Promise<void> }>;
  };
  const hw = createSimulatedHardware(options.script ?? {});
  const running = await mod.startStation({
    port: 0,
    gates: structuredClone(GATES),
    initialEnergy: options.initialEnergy ?? 1000,
    hardware: hw,
  });
  const base = `http://127.0.0.1:${running.port}`;

  async function call(method: string, path: string, body?: unknown): Promise<Reply> {
    const init: RequestInit = { method, headers: { 'content-type': 'application/json' } };
    if (body !== undefined) {
      init.body = typeof body === 'string' ? body : JSON.stringify(body);
    }
    const res = await fetch(base + path, init);
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      // keep raw text
    }
    return { status: res.status, body: parsed };
  }

  const station: TestStation = {
    hw,
    get: (p) => call('GET', p),
    post: (p, b) => call('POST', p, b),
    put: (p, b) => call('PUT', p, b),
    del: (p) => call('DELETE', p),
    ticks: (count) => call('POST', '/ticks', { count }),
    status: async () => (await call('GET', '/status')).body,
    close: () => running.close(),
  };
  open.push(station);
  return station;
}

export async function closeAll(): Promise<void> {
  await Promise.all(open.splice(0).map((s) => s.close()));
}

export function calls(hw: SimulatedHardware, method: string): number {
  return hw.log.filter((c) => c.method === method).length;
}

export function eventsOf(reply: Reply, type: string): any[] {
  return (reply.body.events as any[]).filter((e) => e.type === type);
}
