# Chevron – Regelwerk v0

> Status: **Entwurf v0**. Regel-IDs sind ab jetzt stabil: Eine Regel kann verschärft, gelockert oder
> zurückgezogen werden, ihre ID wird aber nie für etwas anderes wiederverwendet.

Chevron ist ein strenger TypeScript-Dialekt. Jede Datei ist gültiges TypeScript, aber Aufbau,
Abstraktionstiefe, Abhängigkeiten und Fehlerbehandlung sind fest vorgegeben und werden **maschinell
geprüft**, nicht per Prompt erbeten. Die Logik darf sich zwischen zwei Lösungen unterscheiden, die
Struktur nicht.

Das Referenzmodul, an dem jede Regel erfüllt ist, liegt unter
[`examples/gate-registry`](examples/gate-registry/src/modules/gate-registry).

## Inhalt

- [Grundbegriffe](#grundbegriffe)
- [Fehlermeldungsformat](#fehlermeldungsformat)
- [Übersicht aller Regeln](#übersicht-aller-regeln)
- [CHV00x – Typen](#chv00x--typen)
- [CHV01x – Modulaufbau und Benennung](#chv01x--modulaufbau-und-benennung)
- [CHV02x – Abstraktion](#chv02x--abstraktion)
- [CHV03x – Abhängigkeiten und Schichten](#chv03x--abhängigkeiten-und-schichten)
- [CHV04x – Fehlerbehandlung](#chv04x--fehlerbehandlung)
- [CHV09x – Durchsetzung](#chv09x--durchsetzung)
- [Bewusst keine Regeln](#bewusst-keine-regeln)
- [Offene Punkte](#offene-punkte)

## Grundbegriffe

Chevron folgt Ports and Adapters (hexagonale Architektur). Ein **Modul** ist eine fachliche Einheit
(z. B. `gate-registry`, später `energy-budget`, `shield`). Jedes Modul hat dieselben Schichten:

| Schicht     | Inhalt                                                                                        | I/O erlaubt  |
| ----------- | --------------------------------------------------------------------------------------------- | ------------ |
| `domain`    | Datentypen (`type`), Fehlertypen, reine Funktionen                                            | nein         |
| `ports`     | Interfaces für alles, was das Modul von außen braucht (Speicher, Uhr …)                       | nein         |
| `services`  | wiederverwendbare Logik über Ports, die mehrere Use Cases brauchen                            | nur via Port |
| `use-cases` | genau eine fachliche Operation je Use Case, orchestriert Services + Ports                     | nur via Port |
| `adapters`  | Implementierungen von Ports (Datenbank, HTTP-Client …) und Eingangsadapter (HTTP-Routen, CLI) | ja           |

Dazu kommen zwei Dateien im Modul-Wurzelordner:

- `index.ts` – die **öffentliche API** des Moduls. Nur sie darf von außen importiert werden.
- `<modul>.module.ts` – der **Composition Root**. Nur hier werden Implementierungen instanziiert
  und verdrahtet.

**Aufrufrichtung (entschieden für v0, siehe CHV030):**

```
Eingangsadapter ──▶ Use Case ──▶ Service ──▶ Port ◀── Ausgangsadapter (implementiert)
                       │                       ▲
                       └───────────────────────┘
```

Use Cases sind die **einzigen Orchestratoren**. Services rufen nie andere Services oder Use Cases,
Use Cases rufen keine Use Cases desselben Moduls.

**Vertrag** bezeichnet in diesem Dokument ein Interface in `ports/`, `services/` oder `use-cases/`.

## Fehlermeldungsformat

Jede Chevron-Meldung ist für Agents gebaut: eine Zeile, stabile ID, konkrete Korrektur.

```
CHV021 no-inheritance: Class 'GateRegistryServiceImpl' extends 'BaseService'. Fix: Remove 'extends'; implement exactly one interface and inject collaborators via the constructor.
```

Aufbau: `<ID> <slug>: <Befund mit konkreten Namen>. Fix: <eine Anweisung>.`

Meldungen sind englisch (Werkzeugausgabe, Open Source), dieses Dokument ist deutsch. Die CLI gibt
mit `--format json` zusätzlich maschinenlesbar aus:

```json
{
  "ruleId": "CHV021",
  "slug": "no-inheritance",
  "file": "src/modules/gate-registry/services/gate-lookup.service.impl.ts",
  "line": 12,
  "column": 1,
  "message": "Class 'GateLookupServiceImpl' extends 'BaseService'.",
  "fix": "Remove 'extends'; implement exactly one interface and inject collaborators via the constructor.",
  "docs": "https://github.com/TristanDlouhy/chevron-octo-spork/blob/main/RULES.md#chv021"
}
```

## Übersicht aller Regeln

Prüfmethode: **ESLint** = eigene Regel im Plugin, **TSE** = an typescript-eslint delegiert (Chevron
setzt die Optionen fest), **CLI** = Prüfung durch `chevron check` (dateisystem- oder projektweit),
**Config** = durch die mitgelieferte ESLint-Konfiguration erzwungen.

| ID                | Slug                          | Kurzfassung                                               | Prüfung        | Stand          |
| ----------------- | ----------------------------- | --------------------------------------------------------- | -------------- | -------------- |
| [CHV001](#chv001) | strict-tsconfig               | tsconfig mit festem Strict-Satz                           | CLI            | geplant        |
| [CHV002](#chv002) | no-any                        | kein `any`, auch nicht implizit über unsichere Werte      | TSE            | aktiv          |
| [CHV003](#chv003) | no-type-escape                | keine `as`-Assertions (außer `as const`), kein `!`        | TSE            | aktiv          |
| [CHV004](#chv004) | no-ts-directives              | kein `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`      | TSE            | aktiv          |
| [CHV005](#chv005) | explicit-boundary-types       | exportierte Funktionen und Methoden haben Rückgabetypen   | TSE            | aktiv          |
| [CHV010](#chv010) | module-layout                 | fester Ordner- und Dateiaufbau je Modul                   | CLI            | geplant        |
| [CHV011](#chv011) | file-naming                   | kebab-case plus festes Suffix je Schicht                  | ESLint         | geplant        |
| [CHV012](#chv012) | declaration-naming            | Bezeichner passen zum Dateinamen                          | ESLint         | geplant        |
| [CHV013](#chv013) | no-default-export             | nur benannte Exporte                                      | ESLint         | geplant        |
| [CHV014](#chv014) | single-barrel                 | `index.ts` nur im Modul-Wurzelordner                      | CLI            | geplant        |
| [CHV020](#chv020) | one-contract-one-impl         | je Service/Use Case genau ein Interface + eine Impl.      | CLI + ESLint   | geplant        |
| [CHV021](#chv021) | no-inheritance                | kein `extends` bei Klassen und Verträgen, kein `abstract` | ESLint         | geplant        |
| [CHV022](#chv022) | interface-for-contracts-only  | `interface` nur für Verträge, Daten sind `type`           | ESLint         | geplant        |
| [CHV023](#chv023) | use-case-shape                | ein Use Case hat genau eine Methode `execute`             | ESLint         | geplant        |
| [CHV024](#chv024) | constructor-injection         | Abhängigkeiten nur per Konstruktor, typisiert als Vertrag | ESLint         | geplant        |
| [CHV025](#chv025) | impl-only-in-composition-root | `*.impl.ts` nur im Composition Root importieren           | ESLint         | geplant        |
| [CHV030](#chv030) | layer-imports                 | feste Import-Matrix zwischen Schichten                    | ESLint         | geplant        |
| [CHV031](#chv031) | module-public-api             | fremde Module nur über deren `index.ts`                   | ESLint         | geplant        |
| [CHV032](#chv032) | no-cycles                     | keine Kreisbezüge zwischen Dateien und Modulen            | CLI            | geplant        |
| [CHV033](#chv033) | pure-core                     | externe Pakete und Node-Builtins nur in Adaptern          | ESLint         | geplant        |
| [CHV040](#chv040) | no-throw-in-core              | kein `throw` außerhalb von Adaptern                       | ESLint         | geplant        |
| [CHV041](#chv041) | try-catch-only-in-adapters    | `try`/`catch` nur in Adaptern                             | ESLint         | geplant        |
| [CHV042](#chv042) | result-return                 | Vertragsmethoden geben ein Result zurück                  | ESLint (typed) | geplant        |
| [CHV043](#chv043) | tagged-errors                 | Fehlertypen sind Objekte mit literalem `type`-Feld        | ESLint (typed) | geplant        |
| [CHV090](#chv090) | no-inline-config              | keine `eslint-disable`-Kommentare                         | Config + CLI   | aktiv (Config) |
| [CHV091](#chv091) | baseline-ratchet              | Baseline darf nur schrumpfen                              | CLI            | geplant        |

„aktiv“ heißt: in `chevron.configs.recommended` des ESLint-Plugins bereits eingeschaltet.

---

## CHV00x – Typen

### CHV001

**strict-tsconfig** · Prüfung: CLI

**Aussage.** Jede `tsconfig.json`, die Chevron-Code kompiliert, setzt mindestens:

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true,
  "noImplicitOverride": true,
  "noImplicitReturns": true,
  "noFallthroughCasesInSwitch": true,
  "noPropertyAccessFromIndexSignature": true,
  "useUnknownInCatchVariables": true,
  "verbatimModuleSyntax": true
}
```

`extends` ist erlaubt; geprüft wird die aufgelöste Konfiguration (`tsc --showConfig`-Äquivalent).

**Prüfmethode.** `chevron check` löst jede gefundene `tsconfig*.json` auf und vergleicht die
Flags. Ein fehlendes oder auf `false` gesetztes Flag ist ein Verstoß.

**Schlecht**

```json
{ "compilerOptions": { "strict": true, "noUncheckedIndexedAccess": false } }
```

**Gut**

```json
{ "extends": "../../tsconfig.base.json" }
```

**Fehlermeldung**

```
CHV001 strict-tsconfig: 'tsconfig.json' sets 'noUncheckedIndexedAccess' to false. Fix: Set "noUncheckedIndexedAccess": true or extend the Chevron base tsconfig.
```

### CHV002

**no-any** · Prüfung: TSE (`no-explicit-any`, `no-unsafe-argument`, `no-unsafe-assignment`,
`no-unsafe-call`, `no-unsafe-member-access`, `no-unsafe-return`)

**Aussage.** `any` ist verboten, explizit wie implizit. Unbekannte Werte sind `unknown` und werden
per Typprüfung eingeengt.

**Schlecht**

```ts
function parse(raw: any): GateAddress {
  return raw.address;
}
```

**Gut**

```ts
function parse(raw: unknown): Result<GateAddress, InvalidGateAddress> {
  if (typeof raw !== 'string') return err({ type: 'InvalidGateAddress', raw: String(raw) });
  return parseGateAddress(raw);
}
```

**Fehlermeldung**

```
CHV002 no-any: Unexpected 'any' in parameter 'raw'. Fix: Use 'unknown' and narrow with a type guard.
```

> Hinweis: Delegierte Regeln melden sich mit der typescript-eslint-Meldung. Chevron ordnet sie über
> die Regel-ID-Tabelle im Plugin (`ruleCatalog`) der CHV-ID zu; die CLI gibt sie im Chevron-Format aus.

### CHV003

**no-type-escape** · Prüfung: TSE (`consistent-type-assertions` mit `assertionStyle: "never"`,
`no-non-null-assertion`)

**Aussage.** Typ-Assertions (`x as T`, `<T>x`) und Non-null-Assertions (`x!`) sind verboten.
`as const` ist erlaubt. Branded Types entstehen über Type Guards, nicht über `as`.

**Schlecht**

```ts
const address = input as GateAddress;
const gate = gates.get(address)!;
```

**Gut**

```ts
if (!isGateAddress(input)) return err({ type: 'InvalidGateAddress', raw: input });
const gate = gates.get(input);
if (gate === undefined) return err({ type: 'GateNotFound', address: input });
```

**Fehlermeldung**

```
CHV003 no-type-escape: Type assertion 'as GateAddress'. Fix: Narrow with a type guard that returns 'value is GateAddress'.
```

### CHV004

**no-ts-directives** · Prüfung: TSE (`ban-ts-comment`, alle Direktiven verboten, auch mit Beschreibung)

**Aussage.** `// @ts-ignore`, `// @ts-expect-error`, `// @ts-nocheck` und `// @ts-check` sind
verboten. Ein Typfehler wird behoben, nicht stummgeschaltet.

**Schlecht**

```ts
// @ts-expect-error legacy API
legacyClient.send(payload);
```

**Gut** – den Fremdaufruf in einen Adapter legen und dort sauber typisieren.

**Fehlermeldung**

```
CHV004 no-ts-directives: '@ts-expect-error' suppresses a type error. Fix: Fix the type error; wrap untyped third-party code in an adapter.
```

### CHV005

**explicit-boundary-types** · Prüfung: TSE (`explicit-module-boundary-types`,
`explicit-function-return-type` für Methoden in Klassen)

**Aussage.** Exportierte Funktionen und alle Methoden von Klassen deklarieren Parameter- und
Rückgabetypen. So steht der Fehlertyp jedes Results in der Signatur (siehe CHV042), nicht nur in
der Inferenz.

**Schlecht**

```ts
export function decommission(gate: Gate) {
  /* … */
}
```

**Gut**

```ts
export function decommission(gate: Gate): Result<Gate, GateAlreadyDecommissioned> {
  /* … */
}
```

**Fehlermeldung**

```
CHV005 explicit-boundary-types: Missing return type on exported function 'decommission'. Fix: Declare the return type explicitly.
```

---

## CHV01x – Modulaufbau und Benennung

### CHV010

**module-layout** · Prüfung: CLI

**Aussage.** Module liegen unter `src/modules/<modul>/` (Ort konfigurierbar) und haben exakt diesen
Aufbau. Andere Ordner oder Dateien sind nicht erlaubt; leere Schichtordner dürfen fehlen.

```
src/modules/<modul>/
├── index.ts                         # öffentliche API
├── <modul>.module.ts                # Composition Root
├── domain/
│   └── <name>.ts                    # Typen, Fehlertypen, reine Funktionen
├── ports/
│   └── <name>.port.ts               # ein Port-Interface je Datei
├── services/
│   ├── <name>.service.ts            # Service-Interface
│   └── <name>.service.impl.ts       # genau eine Implementierung
├── use-cases/
│   ├── <verb>-<nomen>.use-case.ts       # Use-Case-Interface
│   └── <verb>-<nomen>.use-case.impl.ts  # genau eine Implementierung
└── adapters/
    └── <technik>-<name>.adapter.ts  # implementiert einen Port oder ruft Use Cases
```

Tests liegen neben der getesteten Datei als `<datei>.test.ts`. Unterordner innerhalb einer Schicht
sind nicht erlaubt: Wird eine Schicht zu groß, ist das Modul zu groß und wird geteilt.

**Schlecht**

```
src/modules/gate-registry/
├── helpers/format.ts            # unbekannter Ordner
└── services/impl/lookup.ts      # Unterordner, falsches Suffix
```

**Gut** – siehe [Referenzmodul](examples/gate-registry/src/modules/gate-registry).

**Fehlermeldung**

```
CHV010 module-layout: Unexpected directory 'helpers' in module 'gate-registry'. Fix: Move pure functions to 'domain/', I/O to 'adapters/'.
```

### CHV011

**file-naming** · Prüfung: ESLint (über den Dateipfad)

**Aussage.** Dateinamen sind kebab-case und tragen das Suffix ihrer Schicht:

| Ordner      | Erlaubte Dateinamen                                             |
| ----------- | --------------------------------------------------------------- |
| Modulwurzel | `index.ts`, `<modul>.module.ts`                                 |
| `domain`    | `<name>.ts`                                                     |
| `ports`     | `<name>.port.ts`                                                |
| `services`  | `<name>.service.ts`, `<name>.service.impl.ts`                   |
| `use-cases` | `<verb>-<nomen>.use-case.ts`, `<verb>-<nomen>.use-case.impl.ts` |
| `adapters`  | `<technik>-<name>.adapter.ts`                                   |
| überall     | zusätzlich `<erlaubter-name>.test.ts`                           |

**Schlecht**: `services/GateLookup.ts`, `use-cases/gateFinder.ts`, `ports/repo.ts`

**Gut**: `services/gate-lookup.service.ts`, `use-cases/find-gate.use-case.ts`, `ports/gate-repository.port.ts`

**Fehlermeldung**

```
CHV011 file-naming: 'services/GateLookup.ts' does not match '<name>.service.ts' or '<name>.service.impl.ts'. Fix: Rename to 'services/gate-lookup.service.ts'.
```

### CHV012

**declaration-naming** · Prüfung: ESLint

**Aussage.** Der Hauptbezeichner einer Datei folgt aus ihrem Namen (PascalCase des kebab-case-Namens):

| Datei                                  | Pflicht-Export                      |
| -------------------------------------- | ----------------------------------- |
| `gate-repository.port.ts`              | `interface GateRepository`          |
| `gate-lookup.service.ts`               | `interface GateLookupService`       |
| `gate-lookup.service.impl.ts`          | `class GateLookupServiceImpl`       |
| `find-gate.use-case.ts`                | `interface FindGate`                |
| `find-gate.use-case.impl.ts`           | `class FindGateImpl`                |
| `in-memory-gate-repository.adapter.ts` | `class InMemoryGateRepository`      |
| `gate-registry.module.ts`              | `function createGateRegistryModule` |

Neben dem Hauptbezeichner dürfen Vertragsdateien nur die zugehörigen Ein- und Ausgabetypen
exportieren (`FindGateInput`, `FindGateError`). Implementierungsdateien exportieren nur die Klasse.

**Schlecht**

```ts
// find-gate.use-case.ts
export interface GateFinder {
  execute(input: FindGateInput): ResultAsync<Gate, FindGateError>;
}
```

**Gut**

```ts
// find-gate.use-case.ts
export interface FindGate {
  execute(input: FindGateInput): ResultAsync<Gate, FindGateError>;
}
```

**Fehlermeldung**

```
CHV012 declaration-naming: 'find-gate.use-case.ts' must export interface 'FindGate', found 'GateFinder'. Fix: Rename the interface to 'FindGate'.
```

### CHV013

**no-default-export** · Prüfung: ESLint

**Aussage.** Es gibt nur benannte Exporte. Default-Exporte erlauben beliebige Namen beim Import und
zerstören die Gleichförmigkeit.

**Schlecht**: `export default class FindGateImpl { … }`

**Gut**: `export class FindGateImpl implements FindGate { … }`

**Fehlermeldung**

```
CHV013 no-default-export: Default export in 'find-gate.use-case.impl.ts'. Fix: Use a named export 'export class FindGateImpl'.
```

### CHV014

**single-barrel** · Prüfung: CLI

**Aussage.** Pro Modul gibt es genau eine `index.ts`, im Modul-Wurzelordner. Sie enthält nur
Re-Exporte (`export { … } from` / `export type { … } from`), keine eigene Logik. Exportiert werden
dürfen: Domain-Typen, Vertrags-Interfaces samt Ein-/Ausgabetypen, Adapter-Klassen und die
`create<Modul>Module`-Funktion. Nicht exportiert werden: `*.impl.ts`.

**Schlecht**

```ts
// services/index.ts
export * from './gate-lookup.service.impl';
```

**Gut**

```ts
// index.ts (Modulwurzel)
export type { FindGate, FindGateInput, FindGateError } from './use-cases/find-gate.use-case';
export { createGateRegistryModule } from './gate-registry.module';
```

**Fehlermeldung**

```
CHV014 single-barrel: 'services/index.ts' is a barrel below the module root. Fix: Delete it; export public API only from 'gate-registry/index.ts'.
```

---

## CHV02x – Abstraktion

Kernregel des Dialekts: **genau eine Abstraktionsebene**. Zwischen Aufrufer und Code liegt genau ein
Interface, dahinter genau eine Klasse. Keine Basisklassen, keine Interface-Hierarchien, keine
abstrakten Fabriken. Das betrifft nur den Weg vom Interface zur Implementierung, nicht die Länge von
Aufrufketten.

### CHV020

**one-contract-one-impl** · Prüfung: CLI (Dateipaare) + ESLint (Inhalt)

**Aussage.**

- Zu jeder `<x>.service.ts` existiert genau eine `<x>.service.impl.ts` und umgekehrt; dasselbe gilt
  für Use Cases.
- Die `.impl.ts` enthält genau eine Klasse, und diese implementiert genau das eine Interface aus der
  Partnerdatei (`implements`).
- Ports haben **keine** `.impl.ts`; sie werden von beliebig vielen Adaptern implementiert (z. B.
  In-Memory für Tests, Postgres für Produktion).

**Schlecht**

```ts
// gate-lookup.service.impl.ts
export class GateLookupServiceImpl implements GateLookupService, Auditable { … }
export class CachedGateLookupServiceImpl implements GateLookupService { … }
```

**Gut**

```ts
// gate-lookup.service.impl.ts
export class GateLookupServiceImpl implements GateLookupService { … }
```

**Fehlermeldung**

```
CHV020 one-contract-one-impl: 'gate-lookup.service.impl.ts' declares 2 classes. Fix: Keep exactly one class 'GateLookupServiceImpl implements GateLookupService'.
CHV020 one-contract-one-impl: 'find-gate.use-case.ts' has no implementation file. Fix: Create 'find-gate.use-case.impl.ts' with 'class FindGateImpl implements FindGate'.
```

### CHV021

**no-inheritance** · Prüfung: ESLint

**Aussage.** Klassen dürfen nicht `extends` verwenden und nicht `abstract` sein. Vertrags-Interfaces
dürfen nicht von anderen Interfaces erben. Wiederverwendung läuft über Komposition (Injektion) oder
reine Funktionen in `domain/`.

**Schlecht**

```ts
export abstract class BaseUseCase<I, O> { … }
export class FindGateImpl extends BaseUseCase<FindGateInput, Gate> implements FindGate { … }
export interface FindGate extends UseCase<FindGateInput, Gate> {}
```

**Gut**

```ts
export interface FindGate {
  execute(input: FindGateInput): ResultAsync<Gate, FindGateError>;
}
export class FindGateImpl implements FindGate { … }
```

**Fehlermeldung**

```
CHV021 no-inheritance: Class 'FindGateImpl' extends 'BaseUseCase'. Fix: Remove 'extends'; implement exactly one interface and inject collaborators via the constructor.
```

### CHV022

**interface-for-contracts-only** · Prüfung: ESLint

**Aussage.** Das Schlüsselwort `interface` ist für Verträge reserviert (`ports/`, `services/*.service.ts`,
`use-cases/*.use-case.ts`). Datentypen, Fehlertypen und Ein-/Ausgabetypen sind `type`-Aliase.
`domain/` enthält keine Klassen. Damit erkennt ein Leser (und ein Werkzeug) an einem Wort, ob er
eine Abstraktionsgrenze vor sich hat.

**Schlecht**

```ts
// domain/gate.ts
export interface Gate { address: GateAddress; name: string; }
export class GateEntity { … }
```

**Gut**

```ts
// domain/gate.ts
export type Gate = {
  readonly address: GateAddress;
  readonly name: string;
  readonly status: GateStatus;
};
```

**Fehlermeldung**

```
CHV022 interface-for-contracts-only: 'interface Gate' in 'domain/gate.ts'. Fix: Use 'type Gate = { … }'; interfaces are reserved for ports, services and use cases.
```

### CHV023

**use-case-shape** · Prüfung: ESLint

**Aussage.** Ein Use-Case-Interface hat genau eine Methode `execute` mit genau einem Parameter
(`<UseCase>Input`, ein Objekttyp) und gibt `ResultAsync<…, <UseCase>Error>` oder
`Result<…, <UseCase>Error>` zurück. Ein Use Case ist eine fachliche Operation; mehrere Operationen
sind mehrere Use Cases.

**Schlecht**

```ts
export interface GateUseCases {
  find(address: string): ResultAsync<Gate, FindGateError>;
  register(name: string, address: string): ResultAsync<Gate, RegisterGateError>;
}
```

**Gut**

```ts
export type FindGateInput = { readonly address: string };
export type FindGateError = InvalidGateAddress | GateNotFound | GateRepositoryError;
export interface FindGate {
  execute(input: FindGateInput): ResultAsync<Gate, FindGateError>;
}
```

**Fehlermeldung**

```
CHV023 use-case-shape: Use case 'GateUseCases' declares methods 'find', 'register'. Fix: Split into one interface per operation, each with a single 'execute(input)' method.
```

### CHV024

**constructor-injection** · Prüfung: ESLint (typed)

**Aussage.** Implementierungen (`*.impl.ts`) und Adapter bekommen ihre Abhängigkeiten ausschließlich
über Konstruktor-Parameter mit `private readonly`. Jeder Parameter ist als Vertrag typisiert (Port-,
Service- oder Use-Case-Interface) oder als `type` aus `domain/` (Konfiguration). Innerhalb von
`*.impl.ts` gibt es kein `new` auf Klassen und keinen modulweiten veränderlichen Zustand.

**Schlecht**

```ts
export class FindGateImpl implements FindGate {
  private readonly repository = new InMemoryGateRepository();
}
```

**Gut**

```ts
export class FindGateImpl implements FindGate {
  public constructor(private readonly gateLookup: GateLookupService) {}
}
```

**Fehlermeldung**

```
CHV024 constructor-injection: 'new InMemoryGateRepository()' inside 'find-gate.use-case.impl.ts'. Fix: Add a constructor parameter typed as 'GateRepository' and wire it in 'gate-registry.module.ts'.
```

### CHV025

**impl-only-in-composition-root** · Prüfung: ESLint

**Aussage.** Dateien `*.impl.ts` dürfen nur von `<modul>.module.ts` und von Tests importiert werden.
Alle anderen Dateien hängen von Interfaces ab.

**Schlecht**

```ts
// find-gate.use-case.impl.ts
import { GateLookupServiceImpl } from '../services/gate-lookup.service.impl';
```

**Gut**

```ts
// find-gate.use-case.impl.ts
import type { GateLookupService } from '../services/gate-lookup.service';
```

**Fehlermeldung**

```
CHV025 impl-only-in-composition-root: 'find-gate.use-case.impl.ts' imports '../services/gate-lookup.service.impl'. Fix: Import the interface from '../services/gate-lookup.service' and receive the instance via the constructor.
```

---

## CHV03x – Abhängigkeiten und Schichten

### CHV030

**layer-imports** · Prüfung: ESLint

**Aussage.** Imports innerhalb eines Moduls folgen dieser Matrix (Zeile importiert Spalte).
`type`-Imports zählen genauso wie Wert-Imports.

| importiert →          | domain | ports | services (Interface) | services (impl) | use-cases (Interface) | use-cases (impl) | adapters | fremdes Modul `index.ts` |
| --------------------- | :----: | :---: | :------------------: | :-------------: | :-------------------: | :--------------: | :------: | :----------------------: |
| `domain`              |   ✅   |  ❌   |          ❌          |       ❌        |          ❌           |        ❌        |    ❌    |            ❌            |
| `ports`               |   ✅   |  ❌   |          ❌          |       ❌        |          ❌           |        ❌        |    ❌    |            ❌            |
| `services` Interface  |   ✅   |  ✅¹  |          ❌          |       ❌        |          ❌           |        ❌        |    ❌    |            ❌            |
| `services` impl       |   ✅   |  ✅   |     nur eigenes      |       ❌        |          ❌           |        ❌        |    ❌    |            ❌            |
| `use-cases` Interface |   ✅   |  ✅¹  |         ✅¹          |       ❌        |          ❌           |        ❌        |    ❌    |            ❌            |
| `use-cases` impl      |   ✅   |  ✅   |          ✅          |       ❌        |      nur eigenes      |        ❌        |    ❌    |           ✅²            |
| `adapters`            |   ✅   |  ✅   |          ❌          |       ❌        |          ✅           |        ❌        |    ❌    |            ❌            |
| `<modul>.module.ts`   |   ✅   |  ✅   |          ✅          |       ✅        |          ✅           |        ✅        |    ✅    |            ✅            |
| `index.ts`            |   ✅   |  ✅   |          ✅          |       ❌        |          ✅           |        ❌        |    ✅    |            ❌            |

¹ nur `import type` von Fehlertypen, die im eigenen Fehlertyp vorkommen (z. B. `GateRepositoryError`, `GateLookupError`).
² nur Use-Case-Interfaces fremder Module (über deren `index.ts`). Die Instanz kommt per
Konstruktor; die Verdrahtung macht der Composition Root der Anwendung. Kreise sind verboten (CHV032).

Daraus folgen die Aufrufregeln: **Services rufen keine Services, Use Cases rufen keine Use Cases
desselben Moduls, Adapter rufen nur Use Cases.**

**Schlecht**

```ts
// services/gate-lookup.service.impl.ts
import type { FindGate } from '../use-cases/find-gate.use-case';
```

**Gut**

```ts
// services/gate-lookup.service.impl.ts
import type { GateRepository } from '../ports/gate-repository.port';
```

**Fehlermeldung**

```
CHV030 layer-imports: 'services' (impl) must not import 'use-cases' ('../use-cases/find-gate.use-case'). Fix: Services depend only on domain and ports; move orchestration into a use case.
```

### CHV031

**module-public-api** · Prüfung: ESLint

**Aussage.** Code außerhalb eines Moduls importiert dieses Modul ausschließlich über dessen
`index.ts`. Tiefe Imports (`../energy-budget/domain/…`) sind verboten.

**Schlecht**: `import type { EnergyBudget } from '../energy-budget/domain/energy-budget';`

**Gut**: `import type { EnergyBudget } from '../energy-budget';`

**Fehlermeldung**

```
CHV031 module-public-api: Deep import '../energy-budget/domain/energy-budget' into module 'energy-budget'. Fix: Import from '../energy-budget' and add the export to its index.ts if missing.
```

### CHV032

**no-cycles** · Prüfung: CLI (Import-Graph über das ganze Projekt; ESLint sieht nur eine Datei)

**Aussage.** Der Import-Graph ist azyklisch, auf Datei- und auf Modulebene. Insbesondere dürfen sich
zwei Module nicht gegenseitig über ihre Use Cases aufrufen.

**Schlecht**: `dialing` importiert `energy-budget`, `energy-budget` importiert `dialing`.

**Gut**: gemeinsame Abhängigkeit als Port in einem Modul formulieren, das andere implementiert ihn
über einen Adapter; oder die Abläufe in ein drittes, orchestrierendes Modul ziehen.

**Fehlermeldung**

```
CHV032 no-cycles: Module cycle dialing -> energy-budget -> dialing. Fix: Break the cycle by moving the shared operation into one module and exposing it through its index.ts only.
```

### CHV033

**pure-core** · Prüfung: ESLint

**Aussage.** Imports von npm-Paketen und Node-Builtins (`node:fs`, `node:http` …) sind nur in
`adapters/` und im Composition Root erlaubt. Einzige Ausnahme: die konfigurierte Result-Bibliothek
(Standard: `neverthrow`), die überall erlaubt ist. Ebenso verboten im Kern: globale I/O- und
Zeitquellen (`fetch`, `process`, `console`, `Date.now()`, `new Date()`, `Math.random()`); sie
kommen über Ports (z. B. `Clock`).

**Schlecht**

```ts
// use-cases/register-gate.use-case.impl.ts
import { randomUUID } from 'node:crypto';
const registeredAt = new Date();
```

**Gut**

```ts
// ports/clock.port.ts
export interface Clock {
  now(): Result<Date, never>;
}
```

**Fehlermeldung**

```
CHV033 pure-core: 'node:crypto' imported in 'use-cases'. Fix: Define a port (e.g. 'IdGenerator') and implement it in an adapter.
```

---

## CHV04x – Fehlerbehandlung

Fehler sind Werte. Business-Logik gibt `Result<T, E>` zurück (`ok` / `err`), der Fehlertyp steht in
der Signatur. Exceptions gibt es nur am Rand, wo Fremdcode wirft, und sie werden dort sofort in
Results übersetzt. Chevron empfiehlt **neverthrow**, erzwingt es aber nicht: Die akzeptierten
Result-Typnamen sind konfigurierbar (Standard: `Result`, `ResultAsync`).

### CHV040

**no-throw-in-core** · Prüfung: ESLint

**Aussage.** `throw` ist in `domain/`, `ports/`, `services/` und `use-cases/` verboten. Auch
`Promise.reject(…)` und `async`-Funktionen, die werfen können, sind dort nicht erlaubt; asynchrone
Ergebnisse sind `ResultAsync<T, E>` (bzw. `Promise<Result<T, E>>` bei eigenem Result-Typ).

**Schlecht**

```ts
if (!isGateAddress(raw)) throw new Error('invalid address');
```

**Gut**

```ts
if (!isGateAddress(raw)) return err({ type: 'InvalidGateAddress', raw });
```

**Fehlermeldung**

```
CHV040 no-throw-in-core: 'throw' in 'domain/gate-address.ts'. Fix: Return err({ type: '<ErrorName>', … }) and add the error to the function's Result type.
```

### CHV041

**try-catch-only-in-adapters** · Prüfung: ESLint

**Aussage.** `try`/`catch`/`finally` und `.catch(…)` stehen nur in `adapters/`. Ein Adapter fängt
Exceptions der Fremdbibliothek und gibt sie als getaggten Fehler des Ports zurück (bei neverthrow
idiomatisch über `ResultAsync.fromPromise`).

**Schlecht**

```ts
// use-cases/find-gate.use-case.impl.ts
try { return ok(await this.repository.find(address)); } catch (e) { return err(…); }
```

**Gut**

```ts
// adapters/postgres-gate-repository.adapter.ts
public findByAddress(address: GateAddress): ResultAsync<Gate | null, GateRepositoryError> {
  return ResultAsync.fromPromise(this.client.query(/* … */), (cause) => ({ type: 'GateRepositoryUnavailable', cause }))
    .map(toGate);
}
```

**Fehlermeldung**

```
CHV041 try-catch-only-in-adapters: 'try' block in 'use-cases/find-gate.use-case.impl.ts'. Fix: Let the port return a Result; catch exceptions only in the adapter that calls the throwing library.
```

### CHV042

**result-return** · Prüfung: ESLint (typed, braucht `parserOptions.projectService`)

**Aussage.** Jede Methode eines Vertrags (Port, Service, Use Case) und jede exportierte Funktion in
`domain/`, die scheitern kann, gibt einen der konfigurierten Result-Typen zurück. Domain-Funktionen,
die nicht scheitern können, geben ihren Wert direkt zurück. `void`, `undefined` und `Promise<T>`
ohne Result sind als Rückgabetyp von Vertragsmethoden verboten.

**Schlecht**

```ts
export interface GateRepository {
  findByAddress(address: GateAddress): Promise<Gate | null>;
}
```

**Gut**

```ts
export interface GateRepository {
  findByAddress(address: GateAddress): ResultAsync<Gate | null, GateRepositoryError>;
}
```

**Fehlermeldung**

```
CHV042 result-return: 'GateRepository.findByAddress' returns 'Promise<Gate | null>'. Fix: Return 'ResultAsync<Gate | null, GateRepositoryError>' and declare the error type.
```

### CHV043

**tagged-errors** · Prüfung: ESLint (typed)

**Aussage.** Der Fehlertyp `E` eines Results ist ein Objekttyp oder eine Union von Objekttypen, die
jeweils ein Feld `type` mit einem String-Literal haben (diskriminierte Union). Keine `Error`-Klassen,
keine Strings, keine Enums. Fehlertyp-Namen sind PascalCase-Substantive (`GateNotFound`), der Wert
von `type` ist identisch mit dem Typnamen.

**Schlecht**

```ts
findGate(address: string): ResultAsync<Gate, string>;
findGate(address: string): ResultAsync<Gate, Error>;
```

**Gut**

```ts
export type GateNotFound = { readonly type: 'GateNotFound'; readonly address: GateAddress };
export type FindGateError = InvalidGateAddress | GateNotFound | GateRepositoryError;
```

**Fehlermeldung**

```
CHV043 tagged-errors: Error type 'string' in 'FindGate.execute' is not a tagged object. Fix: Use a type like { readonly type: 'GateNotFound'; … } or a union of such types.
```

---

## CHV09x – Durchsetzung

Ziel: Weder Agent noch Mensch können eine Regel per Ausnahme dauerhaft umgehen. Die Details
(Ausnahmeprozess, Schutz der Baseline, Setup-Befehl) werden in einem eigenen Grilling festgelegt;
v0 legt nur die IDs und die Grundmechanik fest.

### CHV090

**no-inline-config** · Prüfung: Config (`linterOptions.noInlineConfig: true`,
`reportUnusedDisableDirectives: "error"`, ESLint läuft mit `--max-warnings 0`, weil ESLint ignorierte Inline-Kommentare nur als Warnung meldet) + CLI (findet Direktiven auch dann, wenn jemand die
Config umgeht)

**Aussage.** Kommentare wie `// eslint-disable-next-line`, `/* eslint-disable */` oder
`/* eslint chevron/…: off */` sind verboten. Echte Ausnahmen stehen zentral in der Konfiguration,
mit Begründung, und werden per CODEOWNERS von einem Menschen freigegeben.

**Schlecht**

```ts
// eslint-disable-next-line chevron/no-throw-in-core
throw new Error('unreachable');
```

**Gut** – Regel einhalten oder eine zentrale, begründete Ausnahme beantragen.

**Fehlermeldung**

```
CHV090 no-inline-config: Inline directive 'eslint-disable-next-line' in 'domain/gate.ts:14'. Fix: Remove the directive and fix the violation; exceptions belong in chevron.config with a reason.
```

### CHV091

**baseline-ratchet** · Prüfung: CLI

**Aussage.** Für Brownfield-Projekte erfasst `chevron baseline` alle bestehenden Verstöße in
`chevron-baseline.json`. Verstöße in der Baseline werden toleriert, neue nicht. Die Baseline darf nur
schrumpfen: Ein neuer Eintrag oder ein erhöhter Zähler lässt `chevron check` fehlschlagen. In
Greenfield-Projekten ist die Baseline leer.

Eintrag (Entwurf): `{ "ruleId": "CHV040", "file": "src/legacy/billing.ts", "count": 3 }`. Gezählt
wird pro Regel und Datei, nicht pro Zeile, damit Verschiebungen im Code die Baseline nicht brechen.

**Fehlermeldung**

```
CHV091 baseline-ratchet: 'chevron-baseline.json' grew for CHV040 in 'src/legacy/billing.ts' (3 -> 4). Fix: Fix the new violation; the baseline may only shrink.
```

---

## Bewusst keine Regeln

- **Formatierung** (Semikolons, Anführungszeichen, Klammern, Zeilenlänge, einzeilige `if`s) regelt
  allein Prettier (oder Biome). Chevron prüft sie nicht und sie gehört nie in einen Prompt.
- **Länge von Aufrufketten**: erlaubt, solange die Import-Matrix (CHV030) und Azyklizität (CHV032)
  gelten.
- **Bezeichnerlänge**: sprechende Namen bleiben. Kurze Namen sparen kaum Tokens und schaden dem
  Verständnis.
- **Web-Framework**: Express, Hono, Fastify … sind Eingangsadapter. Chevron schreibt keines vor.

## Offene Punkte

1. **Abgrenzung Service vs. Use Case.** Größtes Varianzrisiko des Regelwerks: Ob Logik in einen
   Service oder direkt in den Use Case gehört, bleibt eine Ermessensfrage. Vorschlag für v1: Ein
   Service ist nur erlaubt, wenn mindestens zwei Use Cases ihn nutzen (per CLI prüfbar). Im Benchmark
   messen.
2. **Modulübergreifende Aufrufe.** v0 erlaubt Use Case → fremder Use Case über `index.ts`. Alternative
   wäre ein reiner Port-Ansatz (Modul A definiert Port, Adapter delegiert an Modul B). Strenger, aber
   mehr Code.
3. **Eingangsadapter.** Ob HTTP-Routen in `adapters/` des Moduls oder in einem eigenen App-Ordner
   (`src/app/`) liegen, ist noch nicht festgelegt. Ebenso Ort und Form des App-Composition-Roots.
4. **Klasse vs. Fabrikfunktion.** v0 legt Klassen mit `implements` fest, weil das statisch eindeutig
   prüfbar ist. Fabrikfunktionen mit Rückgabetyp wären idiomatischer, aber schwerer eindeutig zu
   prüfen.
5. **Durchsetzung** (Ausnahmeprozess, Baseline-Schutz, Setup-Befehl, Pre-Commit-Hook): eigenes Grilling.
6. **Prüfwerkzeug-Schnitt.** Welche Regeln im ESLint-Plugin und welche in der CLI landen, klärt ein
   Spike; die Spalte „Prüfung“ oben ist der Ausgangsvorschlag.
