# Benchmark: strukturelle Gleichförmigkeit

Frage: Erzeugen mehrere KI-Agents für dieselbe Aufgabe strukturell ähnlichere Lösungen, wenn sie
Chevron nutzen?

## Aufbau

Fünf Agent-Läufe je Variante, dieselbe Aufgabe ([task/](task/)):

| Variante | Agent bekommt                                    |
| -------- | ------------------------------------------------ |
| A        | nur die Aufgabe                                  |
| B        | Aufgabe + Referenzmodul `examples/gate-registry` |
| C        | Aufgabe + Chevron (Skill, ESLint-Plugin, CLI)    |

Zusätzlich eine Brownfield-Variante: bestehender, unstrukturierter Code, dem ein Feature hinzugefügt
wird.

## Metriken (Entwurf)

- **Dateistruktur:** Ähnlichkeit der Verzeichnisbäume zwischen Läufen (z. B. Tree-Edit-Distance,
  Jaccard über normalisierte Pfade).
- **Abstraktionstiefe:** Anzahl Ebenen zwischen Aufrufer und Implementierung.
- **Abhängigkeiten:** Ähnlichkeit der Import-Graphen auf Schichtebene.
- **Korrektheit:** Anteil bestandener Akzeptanztests aus der Spezifikation.
- **Kosten:** Tokenverbrauch und Anzahl Korrekturschleifen bis grün.

## Ordner

- `task/` – Spezifikation der Aufgabe „Tornetz“ (noch zu schreiben, siehe `task/README.md`)
- `variants/` – Prompts und Startzustände je Variante
- `results/` – Rohdaten und Auswertungen der Läufe

Neutrale Begriffe in allen Veröffentlichungen: Tornetz, Tor, Schild, Gegenstelle. Keine geschützten
Namen aus Film und Fernsehen.
