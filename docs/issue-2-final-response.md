# Issue #2: Work Mode Control - Analyse und Entscheidung

## Zusammenfassung
Nach ausführlicher Analyse der FoxESS Cloud API haben wir festgestellt, dass die Implementierung von Work Mode Control **technisch nicht praktikabel** ist.

## Technische Erkenntnisse

### Zwei separate APIs
FoxESS betreibt zwei komplett getrennte API-Systeme:

1. **OpenAPI** (`/op/v0/`)
   - Token-basierte Authentifizierung (MD5-Signatur)
   - Endpoint: `/op/v0/device/real/query`
   - **Funktion:** Live-Daten auslesen (PV-Leistung, SOC, Grid, etc.)
   - **Status:** ✅ Funktioniert perfekt im aktuellen Adapter

2. **Web-App API** (`/dev/v0/`)
   - Session/Cookie-basierte Authentifizierung
   - Endpoint: `/dev/v0/device/mode/set`
   - **Funktion:** Work Mode setzen (SelfUse, Feedin, Backup, PeakShaving, PowerStation)
   - **Status:** ❌ Nicht mit OpenAPI Token zugänglich

### Work Mode Endpoint Details
```
POST https://www.foxesscloud.com/dev/v0/device/mode/set

Payload:
{
  "deviceID": "8e308417-...",  // UUID, nicht Seriennummer!
  "mode": "SelfUse",            // String, nicht numerisch
  "schedulerEnable": false
}

Verfügbare Modi:
- SelfUse (Eigenverbrauch)
- Feedin (Einspeisungspriorität)
- Backup
- PeakShaving (Spitzenlastabdeckung)
- PowerStation
```

### Login-Komplexität
Um `/dev/v0/` Endpoints zu nutzen, wäre erforderlich:

1. **Initiale Session-ID holen:**
   - Request zur Login-Seite
   - Sid-Header extrahieren

2. **Login durchführen:**
   - Username (nicht Email!)
   - Passwort als MD5-Hash
   - Spezielle Signature (anders als OpenAPI)
   - Sid-Header mitschicken
   - Cookies empfangen und speichern

3. **Session-Management:**
   - Cookies für alle `/dev/v0/` Requests verwenden
   - Session-Ablauf behandeln
   - Re-Login implementieren

4. **DeviceID-Mapping:**
   - Herausfinden wie man von Seriennummer zu DeviceID (UUID) kommt
   - Wahrscheinlich weiterer API-Call nötig

## Warum keine Implementierung?

### 1. Zwei Credential-Sets erforderlich
User müssten konfigurieren:
- **OpenAPI Token** (für Live-Daten)
- **Username + Passwort** (für Work Mode)

→ Deutlich komplexer als aktuelle simple Token-Konfiguration

### 2. Sicherheitsbedenken
- Passwort im Klartext in Adapter-Config speichern
- Oder verschlüsselt, aber dann Key-Management nötig

### 3. Wartungsaufwand
- Session-Management
- Re-Login bei Timeout
- Cookie-Handling
- Zwei komplett unterschiedliche Auth-Flows parallel

### 4. Unklare API-Stabilität
- Web-App API ist nicht offiziell dokumentiert
- Könnte sich jederzeit ändern
- Keine Garantie für Stabilität

## Alternative Lösungen

### Option 1: FoxESS kontaktieren
User könnten bei FoxESS nachfragen, ob es einen offiziellen OpenAPI Endpoint für Work Mode Control gibt oder geplant ist.

### Option 2: Externe Automatisierung
Work Mode Änderungen können über andere Wege automatisiert werden:
- Node-RED mit HTTP-Requests
- Python-Skripte mit Browser-Automation
- ioBroker JavaScript Adapter mit direkten API-Calls

### Option 3: Lokale Steuerung
Wenn der Inverter lokale API hat (manche FoxESS Modelle haben das), könnte Work Mode eventuell direkt am Gerät geändert werden.

## Empfehlung

Der ioBroker.foxesscloud Adapter bleibt **Read-Only** und konzentriert sich auf seine Kernfunktion:
- ✅ Zuverlässiges Auslesen von Live-Daten
- ✅ Einfache Konfiguration (nur Token)
- ✅ Stabile Implementierung mit offizieller OpenAPI

**Work Mode Control wird nicht implementiert** aufgrund der oben genannten technischen und praktischen Einschränkungen.

## Getestete Endpoints

Während der Analyse wurden folgende Endpoints getestet:

**Erfolgreich:**
- `/op/v0/device/real/query` - Live-Daten ✅
- `/dev/v0/device/mode/list` - Verfügbare Modi (nur mit Session)
- `/dev/v0/device/mode/set` - Work Mode setzen (nur mit Session)

**Fehlgeschlagen (mit OpenAPI Token):**
- `/op/v0/device/battery/mode/set` - 404
- `/op/v0/device/mode/set` - Leere Response
- `/op/v0/device/setting/set` - Error 40257
- `/op/v0/device/battery/strategy/set` - Leere Response

## Technische Details für Interessierte

Die vollständige Analyse mit Test-Scripts findest du in:
- `tools/api-test-workmode.js` - Work Mode lesen
- `tools/api-test-workmode-set.js` - Work Mode setzen (verschiedene Endpoints)
- `tools/api-test-login.js` - Login-Flow Analyse
- `tools/api-test-correct-endpoint.js` - Korrekter `/dev/v0/` Endpoint

---

**Fazit:** Issue #2 wird als "nicht umsetzbar" geschlossen. Der Adapter bleibt fokussiert auf Read-Only Funktionalität mit der stabilen OpenAPI.
