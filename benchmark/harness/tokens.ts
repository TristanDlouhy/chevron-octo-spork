// Extract token usage from a Claude Code or Gemini CLI stream-json transcript.
// Usage: node harness/tokens.ts <transcript.jsonl>
import { readFileSync } from 'node:fs';

type Json = Record<string, unknown>;

const lines = readFileSync(process.argv[2] ?? '', 'utf8')
  .split('\n')
  .filter((l) => l.trim().startsWith('{'));
const events: Json[] = [];
for (const line of lines) {
  try {
    events.push(JSON.parse(line) as Json);
  } catch {
    // ignore partial lines
  }
}
const result = [...events].reverse().find((e) => e['type'] === 'result');

function num(v: unknown): number {
  return typeof v === 'number' ? v : 0;
}

let input = 0;
let output = 0;
let cached = 0;
if (result && typeof result['usage'] === 'object' && result['usage'] !== null) {
  // Claude Code
  const u = result['usage'] as Json;
  input = num(u['input_tokens']) + num(u['cache_creation_input_tokens']);
  cached = num(u['cache_read_input_tokens']);
  output = num(u['output_tokens']);
} else if (result && typeof result['stats'] === 'object' && result['stats'] !== null) {
  // Gemini CLI
  const s = result['stats'] as Json;
  input = num(s['input_tokens']) || num(s['prompt_tokens']);
  cached = num(s['cached_tokens']) || num(s['cached']);
  output = num(s['output_tokens']) || num(s['candidates_tokens']);
}

process.stdout.write(
  JSON.stringify(
    {
      found: result !== undefined,
      inputTokens: input,
      cachedInputTokens: cached,
      outputTokens: output,
      totalTokens: input + cached + output,
      turns: num(result?.['num_turns']),
      raw: result ?? null,
    },
    null,
    2,
  ) + '\n',
);
