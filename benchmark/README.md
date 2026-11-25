# Benchmark: strukturelle Gleichförmigkeit

Frage: Erzeugen mehrere KI-Agents für dieselbe Aufgabe strukturell ähnlichere Lösungen, wenn sie
Chevron nutzen?

Protokoll, Metrik und Laufzahl stehen im Dokument „Chevron – Tornetz-Spezifikation &
Benchmark-Protokoll“. Dieser Ordner enthält alles, was die Läufe brauchen.

## Varianten

| Variante | Agent bekommt                                    |
| -------- | ------------------------------------------------ |
| A        | nur die Aufgabe                                  |
| B        | Aufgabe + Referenzmodul aus einer anderen Domäne |
| C        | Aufgabe + Chevron (Skill, ESLint-Plugin, CLI)    |
| D        | Aufgabe + Chevron-Skill ohne Prüfwerkzeug        |

Hauptstudie: mindestens 4 Agents × 6 Wiederholungen je Variante, endgültige Zahl nach dem Pilot.
Der Pilot fährt nur Variante A mit 4 Agents × 5 Wiederholungen.

## Ordner

| Ordner                             | Inhalt                                                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| [`task/scaffold/`](task/scaffold/) | Gerüst, das jeder Agent bekommt: `SPEC.md` (englisch), Hardware-Simulator, Torregister, `package.json` (Node 26, TypeScript 7) |
| [`variants/`](variants/)           | Prompt und Zusatzdateien je Variante                                                                                           |
| [`reference/`](reference/)         | Referenzlösung, nur zur Prüfung der Tests. Wird nie an Agents gegeben                                                          |
| [`acceptance/`](acceptance/)       | Versteckte Akzeptanztests (67 Stück, je eine Regel der Spezifikation)                                                          |
| [`metric/`](metric/)               | Extraktor und Strukturdistanz D (Dateibaum, Abstraktionstiefe, Importgraph)                                                    |
| [`harness/`](harness/)             | Container, Lauf-, Auswerte- und Planungsskripte                                                                                |
| `results/`                         | Rohdaten und Auswertungen der Läufe                                                                                            |

```sh
pnpm --filter @chevron/benchmark test        # versteckte Tests gegen die Referenz + Metrik-Tests
SOLUTION_DIR=<lauf>/work pnpm --filter @chevron/benchmark test:acceptance
```

Neutrale Begriffe in allen Veröffentlichungen: Tornetz, Tor, Schild, Gegenstelle. Keine geschützten
Namen aus Film und Fernsehen.
