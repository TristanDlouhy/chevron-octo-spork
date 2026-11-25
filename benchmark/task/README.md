# Aufgabe „Tornetz“ (Gerüst)

Steuerung eines Netzes von Toren, aufgebaut wie die Planung einer Bodenstation für
Satellitenkommunikation. Keine echte Physik, alle Daten sind vorgegeben.

Module (je eines pro Chevron-Modul):

1. **gate-registry** – Tore mit Adressen registrieren, finden, stilllegen (Referenzmodul, fertig)
2. **dialing** – Anwahl und Verbindungsplanung
3. **energy-budget** – Energiebudget je Anwahl
4. **shield** – Schutzschild der Gegenstelle
5. **telemetry** – Telemetrie von der Gegenstelle

Fehlerfälle: ungültige Adresse, zu wenig Energie, Tor bereits aktiv, Schild geschlossen, Verbindung
abgebrochen.

TODO: präzise Spezifikation mit Eingaben, Ausgaben, Zahlenwerten und Akzeptanztests, damit kein
Agent Details aus bekannten Serien ergänzt.
