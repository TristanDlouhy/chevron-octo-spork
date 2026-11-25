# CLAUDE.md

Chevron ist ein strenger TypeScript-Dialekt: gültiges TypeScript, aber Architektur (Modulaufbau,
genau eine Abstraktionsebene, Schichtgrenzen, Result-Fehlerbehandlung) ist fest vorgegeben und wird
maschinell geprüft. Ziel: Open-Source-Projekt plus Benchmark, der zeigt, dass mehrere Agents damit
strukturell gleichförmigen Code schreiben.

## Wo was liegt

- `RULES.md` – das Regelwerk. Jede Regel hat eine stabile ID (CHV001 …). **Quelle der Wahrheit.**
- `examples/gate-registry/` – Referenzmodul, erfüllt jede Regel. Neue Module kopieren seine Struktur.
- `packages/eslint-plugin/` – ESLint-Plugin (`eslint-plugin-chevron`); `src/rule-catalog.ts` spiegelt
  die Regeltabelle aus RULES.md.
- `packages/cli/` – `chevron`-CLI für projektweite Prüfungen (Layout, Zyklen, Baseline).
- `benchmark/` – Experimentaufbau (Varianten A/B/C) und Aufgabe „Tornetz“.
- `docs/adr/` – Architekturentscheidungen. Jede Regeländerung mit Tragweite bekommt einen ADR.

## Befehle

```sh
pnpm install
pnpm run check        # format:check + typecheck + lint + test (wie CI)
pnpm run lint         # baut die Pakete und führt ESLint mit chevron recommended aus
pnpm run test
pnpm run format       # Prettier
```

## Regeln für die Arbeit in diesem Repo

- Code, Bezeichner, Commit-Messages und Werkzeug-Fehlermeldungen auf Englisch; RULES.md, ADRs und
  Benchmark-Texte auf Deutsch.
- Keine `eslint-disable`-Kommentare und keine `@ts-…`-Direktiven (CHV090, CHV004). Verstoß beheben.
- Formatierung macht ausschließlich Prettier. Keine Formatierungsdiskussion in Regeln oder Prompts.
- Ändert sich eine Regel, ändern sich im selben Commit: RULES.md, `rule-catalog.ts`, ggf. das
  Referenzmodul. IDs werden nie wiederverwendet.
- Neue eigene ESLint-Regeln: Meldungsformat `<ID> <slug>: <Befund>. Fix: <Anweisung>.` (siehe RULES.md).
- Keine schweren Abhängigkeiten. Chevron ist ein Leitplanken-System, kein Framework.
- In allen Texten nur neutrale Begriffe (Tornetz, Tor, Schild), keine geschützten Namen aus Film und
  Fernsehen.
