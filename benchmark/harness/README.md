# Lauf-Werkzeuge

Alles, um einen Lauf reproduzierbar zu fahren und auszuwerten. Die Agents laufen in einem sauberen
Container und sehen nur das Gerüst aus `task/scaffold/` plus den Prompt ihrer Variante. Kein
Chevron-Regelwerk, keine `CLAUDE.md`, keine Agent-Einstellungen des Nutzerkontos.

## Voraussetzungen

- Docker, Node.js 26 LTS (`node --version` ≥ 26.13), pnpm.
- `pnpm install` im Repository-Wurzelordner (für Tests und Metrik).
- `harness/.env` nach Vorlage `.env.example`: `ANTHROPIC_API_KEY` oder `CLAUDE_CODE_OAUTH_TOKEN`
  (Abo, erzeugt mit `claude setup-token`) und `GEMINI_API_KEY`.

## Ablauf

```sh
docker build -t chevron-bench:latest benchmark/harness

# Probelauf (Pilot-Schritt 2): zwei Läufe mit A1
benchmark/harness/run-one.sh A A1 901 && benchmark/harness/evaluate.sh ~/chevron-runs/A-A1-r901

# Pilot: 4 Agents × 5 Wiederholungen, zufällige Reihenfolge
node benchmark/harness/plan.ts 20261125 5 A A1,A2,A3,A4 > pilot-runs.txt
benchmark/harness/run-plan.sh pilot-runs.txt

# Auswertung
node benchmark/harness/summarize.ts > pilot-summary.json
node benchmark/metric/src/cli.ts ~/chevron-runs/A-* > pilot-distances.json
```

Läufe landen in `~/chevron-runs/<variante>-<agent>-r<n>/` (anpassbar mit `CHEVRON_RUNS`):

| Pfad                    | Inhalt                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------ |
| `work/`                 | Arbeitsordner des Agents, als Git-Repo mit den Commits `scaffold` und `agent result` |
| `prompt.md`             | der übergebene Prompt                                                                |
| `logs/transcript.jsonl` | vollständiges Transkript (stream-json)                                               |
| `meta.json`             | Agent, Modell, Versionen, Start, Ende, Exit-Code, Timeout                            |
| `eval/`                 | `tsc`-Ergebnis, versteckte Tests (`acceptance.json`), Tokens                         |

Ein bestehender Lauf wird nie überschrieben. Nur bei Infrastrukturfehlern darf ein Lauf gelöscht und
neu gefahren werden; das wird im Lauflog des Berichts vermerkt.

## Lieferkette

- Repo (pnpm): `minimumReleaseAge` 7 Tage, keine Install-Skripte von Abhängigkeiten
  (`strictDepBuilds`), Lockfile wird in der CI mit `--frozen-lockfile` geprüft.
- Arbeitsordner der Agents (npm): `.npmrc` im Gerüst mit `ignore-scripts=true` und `before=<Datum>`.
  npm löst damit nur Versionen auf, die vor dem Datum erschienen sind, auch für Pakete, die ein Agent
  nachinstalliert. Beim Einfrieren (v1.0) wird das Datum auf mindestens 7 Tage vor dem ersten Lauf
  gesetzt und danach nicht mehr geändert.
- Agent-CLIs im Image sind auf Versionen gepinnt, die beim Pinnen mindestens 7 Tage alt waren.

## Im Probelauf zu prüfen

- Gemini CLI: Greifen die Ausschlüsse der Web-Werkzeuge aus `gemini-settings.json`? Im Transkript
  darf kein `google_web_search` oder `web_fetch` auftauchen.
- `tokens.ts`: Stimmen die Tokenzahlen mit der Abrechnung des Anbieters überein? Das Format der
  Gemini-Statistik ist noch nicht gegen einen echten Lauf geprüft.
- Unter Linux muss der Arbeitsordner für den Container-Nutzer `node` (UID 1000) beschreibbar sein.
