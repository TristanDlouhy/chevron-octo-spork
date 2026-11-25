# Varianten

Jede Variante ist ein Ordner mit `prompt.md` (wird dem Agent unverändert übergeben) und optional
`extra/` (Dateien, die zusätzlich zum Gerüst in den Arbeitsordner kopiert werden).

| Variante | Prompt                     | Zusatzdateien                                                                                                        |
| -------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| A        | [A/prompt.md](A/prompt.md) | keine                                                                                                                |
| B        | folgt                      | Referenzmodul aus einer **anderen** Domäne (nicht `examples/gate-registry`, das ist dieselbe Domäne wie die Aufgabe) |
| C        | folgt                      | Chevron-Skill, ESLint-Plugin und CLI im Agent-Loop                                                                   |
| D        | folgt                      | nur der Chevron-Skill, ohne Prüfwerkzeug                                                                             |

Der Prompt-Kern aller Varianten ist identisch mit A; B, C und D fügen nur einen klar markierten Block an.
