# Chevron

> Working title. A strict TypeScript dialect with built-in architecture rules, enforced by tooling.

When AI agents write TypeScript, five agents given the same task produce five different structures.
Chevron fixes the structure and lets the logic vary: every file is plain TypeScript, but module
layout, abstraction depth (exactly one interface, one implementation), layer boundaries and
Result-based error handling are checked by an ESLint plugin and a CLI, not requested in a prompt.

- **Rules:** [RULES.md](RULES.md) (German, rule IDs `CHV001` …)
- **Reference module:** [examples/gate-registry](examples/gate-registry)
- **Tooling:** [packages/eslint-plugin](packages/eslint-plugin), [packages/cli](packages/cli)
- **Benchmark:** [benchmark](benchmark)

Design principles: lean, framework-agnostic (ports and adapters), brownfield-ready via a shrink-only
baseline.

Status: rule set v0 draft, tooling scaffold. Not usable yet.

## Development

```sh
pnpm install
pnpm run check
```

## License

[MIT](LICENSE)
