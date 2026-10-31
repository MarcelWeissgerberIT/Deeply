# Delegations-Cockpit

Ein zentraler Überblick über alles, was ich an Menschen oder KI-Agenten abgegeben habe: wer arbeitet woran, was ist überfällig, wo werde ich gebraucht. Das Cockpit übernimmt Erinnern, Nachfassen und Eskalieren. Ich greife nur bei Ausnahmen ein.

Läuft als Modul oder View auf Atlas und liest bestehende Systeme. Es ist kein weiteres Projektmanagement-Tool.

> **Stand: Prototyp mit Demo-Daten.** Alle Personen, Agenten und Datensätze sind erfunden. Refs tragen das Präfix `DEMO-`. Es gibt noch keine Verbindung zu Atlas, Jira, Polarion oder Mail.

## Funktionen

| # | Funktion | Wo im Code |
|---|----------|-----------|
| 1 | Delegations-Übersicht: Empfänger, Ziel, Frist, Status, letztes Lebenszeichen | `src/components/DelegationList.tsx` |
| 2 | Ampel: Rot = überfällig, blockiert oder eskaliert; Gelb = X Tage ohne Update oder wartet auf meine Freigabe; Standardansicht nur Gelb und Rot | `src/domain/ampel.ts` |
| 3 | Automatisches Nachfassen: Status-Anfrage, bevor etwas kippt; Antwort wird zum Update; ohne Antwort nach einem Tag Vorschlag zur Eskalation | `src/domain/followUp.ts`, `src/components/FollowUpPanel.tsx` |
| 4 | Meine Blocker: Freigaben, Entscheidungen, Inputs, jeweils mit einem Klick erledigt | `src/components/BlockerPanel.tsx` |
| 5 | Delegieren per Satz: „Gib X an Y bis Freitag“ legt die Aufgabe mit Owner, Frist und Kontext an | `src/domain/parseDelegation.ts`, `src/domain/parseDeadline.ts` |
| 6 | Wochen-Digest: erledigt, gefährdet, braucht mich; als Text kopierbar | `src/domain/digest.ts`, `src/components/DigestView.tsx` |
| 7 | Agenten gleichberechtigt: gleiche Karte, gleiche Ampel, Freigabe vor kritischen Schritten | `src/components/TeamView.tsx` |

Jede Aktion landet mit Zeitstempel und Akteur im Verlauf der Delegation (Detailansicht). Das macht Verantwortlichkeiten nachvollziehbar.

### Delegieren per Satz: was verstanden wird

- Satzformen: `Gib|Übergib|Delegiere|Schick … an <Name> bis <Frist>` und `<Name> soll … bis <Frist> [erledigen|erstellen|…]`
- Empfänger: voller Name, Vor- oder Nachname, Agentenname (`Review-Agent`, `den Review-Agent`)
- Fristen: `heute`, `morgen`, `übermorgen`, Wochentage (`Freitag`, `Fr`, `nächsten Freitag`), `Ende der Woche`, `nächste Woche`, `in 3 Tagen`, `in 2 Wochen`, `14.11.`, `14.11.2026`, `KW 46`, `Monatsende`, `2026-11-20`
- Kontext nach Gedankenstrich, Semikolon oder `, Kontext:`

Was nicht eindeutig ist, wird nicht geraten: unbekannte oder mehrdeutige Empfänger und unverständliche oder vergangene Fristen erzeugen einen konkreten Hinweis.

## Entwicklung

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest: Fachlogik und Zustandsübergänge
npm run build      # Typecheck + Produktions-Build nach dist/
```

`.npmrc` setzt `legacy-peer-deps=true`, weil npm 10 beim Auflösen der optionalen Peer-Abhängigkeiten von Vitest 4 abbricht.

## Aufbau

```
src/domain/     reine Fachlogik ohne React (Ampel, Nachfassen, Parser, Digest, Datumsfunktionen)
src/state/      Reducer mit allen Zustandsübergängen, React-Hook
src/data/       Demo-Daten (wird für den Produktivbetrieb durch einen Atlas-Loader ersetzt)
src/components/ Oberfläche
```

Der Reducer (`src/state/cockpit.ts`) ist rein: jede Aktion bringt ihren Zeitstempel mit. Ungültige Aktionen werfen eine Fehlermeldung, die die Oberfläche als Hinweis anzeigt.

## Anbindung an Atlas (nächster Schritt)

`src/data/demo.ts` liefert einen `CockpitState`. Ein Atlas-Loader muss dieselbe Form liefern:

| Cockpit | Atlas-Quelle |
|---------|-------------|
| `Delegation.recipientId` | Feld `assignee` des Records, bei Agent-Jobs der Agent |
| `Delegation.due` | Feld `due` |
| `Delegation.status` | Feld `status` (`done` → erledigt) |
| `Delegation.lastSignalAt` | Feld `updated` bzw. letzter Kommentar/Worklog des Owners |
| `Delegation.events` | Kommentare, Worklogs und Statuswechsel des Records |
| `Blocker` (Freigabe) | Agent-Jobs, die auf meine Freigabe warten (Approvals) |
| `Recipient` (Agent) | Agentenliste mit Owner |

Die Auswahl „was habe ich abgegeben“ entspricht einer AQL-Abfrage wie `createdBy = <ich> AND assignee != <ich> AND status != done`. Atlas-Zugriff braucht einen serverseitigen Proxy, damit kein Token im Browser liegt.
