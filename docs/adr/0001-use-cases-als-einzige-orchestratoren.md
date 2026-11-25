# ADR 0001: Use Cases als einzige Orchestratoren

- Status: angenommen
- Datum: 2026-11-25
- Betrifft Regeln: CHV023, CHV030, CHV032

## Kontext

Das Briefing ließ offen, wer wen aufrufen darf. Ziel von Chevron ist, dass mehrere Agents für
dieselbe Aufgabe dieselbe Struktur erzeugen. Die Frage „Service ruft Service“ ist eine der größten
Quellen struktureller Varianz.

## Entscheidung

Die Use-Case-Schicht ist Pflicht. Eingangsadapter rufen nur Use Cases, Use Cases rufen Services und
Ports, Services rufen nur Ports. Services rufen keine Services, Use Cases keine Use Cases desselben
Moduls. Modulübergreifend darf ein Use Case die Use-Case-Interfaces eines anderen Moduls über dessen
`index.ts` nutzen, azyklisch.

## Konsequenzen

- Die Aufrufstruktur ist vollständig per Import-Matrix (CHV030) prüfbar.
- Auch triviale Operationen brauchen einen Use Case (mehr Dateien).
- Die Abgrenzung „Logik in den Service oder in den Use Case“ bleibt ein Ermessensspielraum und damit
  ein Varianzrisiko; siehe RULES.md, Offene Punkte.

## Verworfene Alternativen

- Keine Use-Case-Schicht, Services dürfen Services aufrufen (azyklisch): weniger Dateien, aber mehr
  Freiheitsgrade bei der Aufrufstruktur.
- Use Cases nur für modulübergreifende Abläufe: Regel hängt von einer Ermessensfrage ab („braucht das
  mehrere Module?“).
