# ADR 0002: Prüfwerkzeug – ESLint-Regeln pro Datei, `chevron check` als einziges Gate

- Status: angenommen
- Datum: 2026-11-25
- Betrifft Regeln: CHV002, CHV010, CHV020, CHV021, CHV090, CHV091 (Schnitt aller Regeln, RULES.md
  Offener Punkt 6)

## Kontext

RULES.md v0 lässt offen, welche Regeln im ESLint-Plugin und welche in einer eigenen CLI landen. Zur
Wahl standen:

- **A – reines ESLint-Plugin** (eigene Regeln + an typescript-eslint delegierte Regeln, Typinformation
  über `projectService`, `noInlineConfig`, ESLint-9/10-Bulk-Suppressions als Baseline).
- **B – eigene CLI auf ts-morph**, die alle Regeln selbst prüft.
- **C – Mischform**: Regeln pro Datei als ESLint-Regeln, projektweite Prüfungen in der CLI, und die
  CLI startet ESLint über die Node-API mit einer Konfiguration, die Chevron gehört.

Dazu die Frage, ob eslint-plugin-boundaries, dependency-cruiser oder Sheriff Teile übernehmen können.

Der Spike setzt drei Regelgruppen in beiden Varianten um: **kein `any`** (CHV002), **fester
Modulaufbau** (CHV010) und **Abstraktionstiefe** (CHV020, CHV021), zusätzlich CHV090
(Inline-Direktiven) und CHV091 (Baseline). Versionen: ESLint 10.15, typescript-eslint 8.74,
TypeScript 6.0.3, ts-morph 28.0.

### Spike-Code

Der vollständige Spike mit beiden Engines (`chevron check --engine eslint|ts-morph`) liegt im
Commit `508cb2b` (PR #2, erster Commit). Alle Zahlen unten stammen von dort.
Nach der Entscheidung blieb nur Variante C im Repo:

| Ort                                      | Inhalt                                                                                        |
| ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| `packages/eslint-plugin/src/rules/`      | ESLint-Regeln `chevron/chv020` (Inhalt) und `chv021`, registriert, nicht in `recommended`     |
| `packages/eslint-plugin/src/formatters/` | Umsetzung von ESLint-Ergebnissen ins JSON-Format aus RULES.md                                 |
| `packages/cli/src/check/`                | `chevron check`: ESLint mit gesperrter Config, CHV010, CHV020-Paare, CHV090-Scanner, Baseline |
| `packages/cli/test/fixtures/violations/` | Tornetz-Fixture mit 23 gezielt platzierten Verstößen                                          |
| `packages/cli/test/check.test.ts`        | alle Verstöße gefunden, 0 Treffer am Referenzmodul, Ratchet                                   |

Reproduzieren: `pnpm run build && node packages/cli/dist/main.js check --project packages/cli/test/fixtures/violations --format json`.

## Ergebnisse

### 1. Treffer

| Messung                                           | A: nur ESLint | B: ts-morph-CLI | C: Hybrid |
| ------------------------------------------------- | ------------- | --------------- | --------- |
| Fixture, 23 geplante Verstöße                     | 20            | 23              | 23        |
| Referenzmodul `examples/gate-registry`            | 0 Fehlalarme  | 0               | 0         |
| `any`-Lückentest (9 Fälle laut typescript-eslint) | 9             | 6 + 1 Fehlalarm | 9         |

- **A verfehlt alles, was keine TypeScript-Datei ist**: ein Modul ganz ohne `.ts`-Datei, `README.md`
  im Modul, fehlende `index.ts`. ESLint bekommt solche Pfade nie zu sehen. Modulweite Befunde
  („`energy-budget.module.ts` fehlt“) muss die Regel an irgendeine Datei hängen; der Spike nimmt die
  alphabetisch erste, hier `domain/energy.ts`. Für einen Agent ist das ein irreführender Ort.
- **B musste CHV002 nachbauen.** Die eigene Umsetzung der sechs typescript-eslint-Regeln erkennt im
  Lückentest Destrukturierung, `new Map(JSON.parse(…))` und Zuweisungen an `let` nicht und meldet
  `Promise.resolve(anyValue)` fälschlich. typescript-eslint pflegt diese Fälle seit Jahren; ein
  Nachbau ist dauerhafte Wartung ohne Mehrwert.
- Für CHV020 löst B `implements` über den Type Checker auf (robust gegen Aliase und Re-Exporte), die
  ESLint-Regel vergleicht nur Importpfade. Mit `parserServices` ginge das in ESLint ebenso.

### 2. Durchsetzung (CHV090, CHV091)

Gemessen am Fixture, Exit-Code 0 heißt „Prüfung bestanden“:

| Umgehungsversuch                                                        | A: ESLint-CLI + Projekt-Config                                                          | C: `chevron check`                             |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `// eslint-disable-next-line …`                                         | wirkungslos, aber nur **Warnung ohne Regel-ID**; scheitert nur mit `--max-warnings 0`   | CHV090-Fehler aus eigenem Scanner              |
| `/* eslint-disable */` am Dateianfang                                   | wie oben                                                                                | CHV090-Fehler                                  |
| `eslint . --rule 'chevron/chv021: off'`                                 | **Exit 0**                                                                              | nicht möglich, CLI kennt keine Regel-Overrides |
| Override-Block `rules: { 'chevron/chv021': 'off' }` in eslint.config.js | **Exit 0**                                                                              | wirkungslos (`overrideConfigFile: true`)       |
| eigene `eslint.config.js` in einem Unterordner                          | **ersetzt die Root-Config** für diesen Ordner (ESLint 10 sucht die Config ab der Datei) | wirkungslos                                    |
| `eslint --no-config-lookup`                                             | Exit 0                                                                                  | –                                              |

ESLint-Bulk-Suppressions (`eslint-suppressions.json`, Zählung pro Datei und Regel, wie der
CHV091-Entwurf):

| Schritt                                | Ergebnis                                      |
| -------------------------------------- | --------------------------------------------- |
| neuer Verstoß nach `--suppress-all`    | Exit 1 – gut                                  |
| Verstoß behoben, Datei nicht bereinigt | Exit 2 – gut, erzwingt `--prune-suppressions` |
| `--pass-on-unpruned-suppressions`      | Exit 0 – Ratchet abschaltbar                  |
| Agent ruft erneut `--suppress-all`     | Exit 0 – neuer Verstoß still geschluckt       |
| Zähler in der Datei von Hand erhöht    | Exit 0                                        |

Die eigene Baseline im Spike verhält sich beim Zählen gleich, mit zwei Unterschieden:
`chevron baseline` verweigert das Überschreiben einer vorhandenen Baseline (nur `--prune`, das
ausschließlich verkleinert), und sie deckt auch Befunde ab, die ESLint nie sieht (CHV010, später
CHV001, CHV032). Gegen Löschen oder Handbearbeitung schützt **keine** Variante; das muss CI leisten
(Baseline gegen den Stand des Zielbranchs vergleichen, CODEOWNERS auf die Datei).

### 3. Cache und Editor

ESLint-Regeln, die das Dateisystem lesen (CHV010, Paarprüfung in CHV020), liefern mit `--cache`
**veraltete Ergebnisse**: Nach dem Anlegen von `plan-connection.use-case.impl.ts` meldete
`eslint --cache` weiterhin „has no implementation file“, ohne Cache nicht. ESLint kennt die
Abhängigkeit zur Nachbardatei nicht. Im Editor gilt dasselbe, bis die betroffene Datei neu gelintet
wird.

### 4. Laufzeit und Speicher

Kopien des Referenzmoduls, 4 Kerne, Mittel aus zwei Läufen:

| Projekt               | C: Hybrid (11 delegierte + 2 eigene Regeln) | B: ts-morph (6-Fall-Nachbau) |
| --------------------- | ------------------------------------------- | ---------------------------- |
| 800 Dateien, 19 kLOC  | 4,2 s, 630 MB RSS                           | 2,5 s, 365 MB                |
| 3200 Dateien, 77 kLOC | 14,1 s, 1,3 GB                              | 7,6 s, 700 MB                |

Weitere Messungen auf 3200 Dateien: reines ESLint mit Typinformation 14,4 s; `--concurrency 4` 13,9 s
(kein Gewinn, jeder Worker baut sein eigenes TypeScript-Programm); warmer Cache 1,8 s (aber siehe
Abschnitt 3); ESLint **ohne** Typinformation nur mit den drei Spike-Regeln 7,2 s, fast ausschließlich
durch das Verzeichnislesen pro Datei in CHV010.

Der Vergleich ist nicht fair zugunsten von B: B prüft weniger. Er zeigt aber, dass Typinformation
der dominierende Kostenblock ist und dass ts-morph keinen Größenordnungsvorteil bringt. Für die
Projektgrößen, auf die Chevron zielt, sind beide Varianten in CI tragbar.

### 5. Abhängigkeiten und Typen

- ts-morph 28 bringt **eine eigene TypeScript-Kopie** mit (`@ts-morph/common`, 13 MB, TypeScript
  6.0.2, das Projekt nutzt 6.0.3). Zwei Compiler können Code unterschiedlich bewerten.
- `@typescript-eslint/utils` (0,5 MB) liefert typisierte TS-AST-Knoten für eigene Regeln. Seine
  `RuleModule`-Typen passen nicht exakt zu den `Plugin`-Typen von ESLint 10; im Spike überbrückt ein
  Type Guard das ohne Assertion (CHV003). Ärgerlich, aber lokal begrenzt.
- Umfang: ESLint-Regeln + Formatter 494 Zeilen, CLI-Spike 702 Zeilen.

### 6. Fremdwerkzeuge

Am selben Fixture ausprobiert (Sheriff und dependency-cruiser zusätzlich mit einem eingebauten
Deep-Import):

| Werkzeug                       | deckt ab                                                                                                                                                 | deckt nicht ab                                                                                    | Eindruck                                                                                   |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| eslint-plugin-boundaries 7.4   | CHV010 teilweise (`no-unknown-files` fand `helpers/`, `services/impl/`, `services/base.ts`), laut Doku CHV030/CHV031 über Elementtypen und `entry-point` | fehlende Dateien, Nicht-TS-Dateien, leere Module, Klasseninhalt, `any`                            | gut für Import-Matrix; generische Meldungen ohne „Fix“; 6 Laufzeitabhängigkeiten           |
| dependency-cruiser 18.9        | CHV032 (Zyklen), Pfadregeln für CHV030/CHV031, JSON-Ausgabe                                                                                              | Layout nur über „orphan“-Heuristik (meldete auch das gültige `shield.module.ts`), kein AST-Inhalt | stärkstes Werkzeug für den Import-Graphen; 18 Abhängigkeiten, eigene Config-Sprache        |
| Sheriff 0.20 (+ ESLint-Plugin) | CHV031 (Deep-Import korrekt erkannt), CHV030 über Tags                                                                                                   | Layout, Inhalt, `any`; prüft nur vom `entryFile` aus erreichbare Dateien                          | passt konzeptionell (Barrel = `index.ts`), aber Angular-geprägt und braucht Einstiegsdatei |

Keines der drei prüft Abstraktionstiefe (CHV020/021) oder den Dateiaufbau vollständig. Sie
überschneiden sich mit genau den Regeln (CHV030–032), die mit dem vorhandenen Pfad-Helfer
(`resolveModulePath`) als eigene Regeln wenige Dutzend Zeilen kosten.

## Entscheidung

**Variante C.**

1. **Regeln pro Datei sind ESLint-Regeln** im Plugin, auf `@typescript-eslint/utils`. Sie arbeiten
   nur auf AST und Typinformation der gelinteten Datei und **lesen nie das Dateisystem**. Das gilt
   für CHV011–013, CHV020 (Inhalt der `.impl.ts`), CHV021–025, CHV030, CHV031, CHV033, CHV040–043.
2. **CHV002–CHV005 bleiben an typescript-eslint delegiert.** Kein Nachbau.
3. **Projektweite Prüfungen liegen in `chevron check`**: CHV001, CHV010, CHV014, CHV020
   (Paarprüfung), CHV032, CHV090 (eigener Kommentar-Scanner), CHV091. Sie laufen auf dem Dateisystem
   und, wo nötig, auf der TypeScript-API des Projekts (`typescript` als Peer-Dependency), **nicht auf
   ts-morph**.
4. **`chevron check` ist das einzige verbindliche Gate** (CI, Pre-Commit, Agent-Hooks). Es startet
   ESLint über die Node-API mit `overrideConfigFile: true`, `allowInlineConfig: false` und der von
   Chevron gelieferten Konfiguration. Projekt-eigene ESLint-Configs, `--rule`-Overrides und
   verschachtelte Configs haben darauf keinen Einfluss. Echte Ausnahmen kommen ausschließlich aus
   `chevron.config` (Format offen, siehe Grilling Durchsetzung).
5. **`eslint` direkt mit `chevron.configs.recommended` bleibt erlaubt, aber nur als Komfort** für
   Editor-Feedback. Es ist nicht maßgeblich.
6. **Eine Baseline, im Chevron-Format** (`chevron-baseline.json`, CHV-ID + Datei + Anzahl), von der
   CLI verwaltet. ESLint-Bulk-Suppressions werden nicht genutzt: Sie kennen nur ESLint-Regelnamen
   (CHV002 zerfällt in sechs), sehen keine CLI-Befunde und schlucken neue Verstöße bei erneutem
   `--suppress-all`.
7. **Ausgabe**: ein JSON-Format für alle Befunde, so wie in RULES.md beschrieben; ESLint-Befunde
   werden über `ruleCatalog` auf CHV-IDs abgebildet (`toChevronFindings`).
8. **Keine Fremdwerkzeuge im Kern.** dependency-cruiser bleibt Kandidat für CHV032, falls eine eigene
   Zyklenprüfung über `ts.resolveModuleName` zu aufwendig wird; das entscheidet die Umsetzung von
   CHV032.

## Konsequenzen

- Die Spalte „Prüfung“ in RULES.md bleibt im Kern richtig. **CHV020** ist „CLI (Dateipaare) +
  ESLint (Inhalt)“, so wie im Regeltext; **CHV010** liegt komplett in der CLI. Beides ist im Code
  umgesetzt (die ESLint-Regel `chevron/chv010` aus dem Spike ist gelöscht). Falls RULES.md dazu
  präzisiert werden soll, macht das der Thread, der das Regelwerk pflegt.
- `rule-catalog.ts` braucht ein Feld `fix` für delegierte Regeln; der Spike hält die Texte vorerst im
  Formatter (`DELEGATED_FIX`).
- Für Agents gilt nur `chevron check --format json`. Das gehört in die Agent-Anleitung (Stufe 3).
- `chevron check` kostet auf 3200 Dateien rund 14 s und 1,3 GB. Für Pre-Commit-Hooks braucht es
  später einen Modus „nur geänderte Dateien“ (ESLint pro Datei, CLI-Prüfungen nur für betroffene
  Module).
- Baseline-Schutz ist nicht gelöst, nur verlagert: CI muss `chevron-baseline.json` gegen den
  Zielbranch prüfen (darf nur schrumpfen). Das ist Teil des Grillings „Durchsetzung“.
- ts-morph und die Option `--engine` sind nach dem Spike wieder entfernt. Die CLI nutzt `eslint`,
  `typescript-eslint` und `typescript` als Peer-Dependencies.

## Verworfene Alternativen

- **A – reines ESLint-Plugin.** Bequem und im Ökosystem verankert, aber als Gate nicht dicht: drei
  dokumentierte Wege, Regeln ohne Spur abzuschalten (`--rule`, Override-Block, verschachtelte Config),
  Inline-Direktiven nur als Warnung, kein Blick auf Nicht-TS-Dateien und leere Module, veraltete
  Cache-Ergebnisse bei Dateisystem-Regeln.
- **B – eigene CLI auf ts-morph für alles.** Volle Kontrolle und schneller, aber CHV002–005 müssten
  nachgebaut werden (Lückentest: 3 verpasste Fälle, 1 Fehlalarm), kein Editor-Feedback, und ein
  zweiter TypeScript-Compiler im Abhängigkeitsbaum.
- **eslint-plugin-boundaries / Sheriff für CHV030–031.** Funktioniert für Teile, bringt aber eigene
  Konfigurationssprachen, Meldungen ohne Chevron-ID und „Fix“, und Abhängigkeiten für Regeln, die
  selbst geschrieben klein bleiben.
