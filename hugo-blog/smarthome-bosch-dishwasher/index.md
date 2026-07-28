---
title: "🍽️ Bosch Geschirrspüler lokal im Smart Home – Echtzeit-Dashboard ohne Cloud"
date: 2026-07-07T10:00:00
description: "Lokale Anbindung eines Bosch Home Connect Geschirrspülers via WebSocket, MQTT und FastAPI – mit Session-Tracking, Verbrauchsanalyse und Web-Dashboard."
type: "post"
draft: false
image: "posts/smarthome-bosch-dishwasher/dishwasher.png"
author: "Peter Siebler"
snap_gallery: true
gallery: true
categories:
  - "Smarthome"
tags: ["docker", "python", "fastapi", "mqtt", "homeassistant"]
---

[![Github Project](https://img.shields.io/badge/Project-GitHub-yellow.svg)](https://github.com/zibous/hc_bosch)
[![Support author](https://img.shields.io/badge/buy%20me%20a%20coffee-orange.svg)](https://www.buymeacoff.ee/zibous)
[![License](https://img.shields.io/badge/license-Open%20Source-green.svg)](https://opensource.org)
![Python](https://img.shields.io/badge/Python-3.12-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688.svg)

## Der Geschirrspüler als intelligenter Datenpunkt

Moderne Bosch-Siemens Geschirrspüler mit Home Connect sprechen ein proprietäres WebSocket-Protokoll über das lokale Netzwerk. Das bedeutet: **Kein Cloud-Polling nötig** – alle Statusdaten wandern direkt vom Gerät in die eigene Infrastruktur. Mit **hc_bosch** entsteht daraus ein vollwertiges Verbrauchs-Dashboard mit Session-Erkennung, Kostenberechnung und Home Assistant Integration.

<!--more-->

## Warum lokal statt Cloud?

Die offizielle Home Connect Cloud-API hat Rate-Limits, Latenz und eine Abhängigkeit von Bosch-Servern. Die lokale Variante bietet entscheidende Vorteile:

- **Echtzeit-Daten** – Statusänderungen kommen in Millisekunden, nicht Minuten
- **Kein Internet nötig** – funktioniert auch bei Provider-Ausfall
- **Volle Kontrolle** – keine Telemetrie an Dritte, keine API-Änderungen durch den Hersteller
- **Unbegrenzte Abfragen** – kein Throttling, kein OAuth-Token-Refresh

Der Geschirrspüler öffnet einen lokalen HTTPS-Port mit der ungewöhnlichen Cipher-Suite `ECDHE-PSK-CHACHA20-POLY1305`. Eine speziell angepasste TLS/PSK-Implementierung stellt die WebSocket-Verbindung her und empfängt kontinuierlich Statusmeldungen.

---

## 🏗️ Architektur & Datenfluss

Die Anwendung basiert auf FastAPI und verbindet drei Kernkomponenten: den WebSocket-Listener zum Gerät, einen optionalen MQTT-Publisher und eine SQLite-Datenbank für die Langzeit-Analyse.

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                            main.py (Entry)                              │
└────────┬──────────────────────┬─────────────────────────┬───────────────┘
         │                      │                         │
         ▼                      ▼                         ▼
┌─────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│  FastAPI Server │  │  MQTT WebSocket Feed │  │  Sensor Publisher    │
│  (Port 5021)    │  │  (Bosch Appliance)   │  │  (30s aktiv/120s)    │
└────────┬────────┘  └──────────┬───────────┘  └──────────┬───────────┘
         │                      │                         │
         │                      ▼                         │
         │           ┌──────────────────────┐             │
         │           │   State Manager      │             │
         │           │   (data2mqtt.py)     │◄────────────┘
         │           └─────┬──────────┬─────┘
         │                 │          │
         │                 ▼          ▼
         │     ┌────────────────┐  ┌──────────────────┐
         │     │ status.json    │  │ Session Tracker  │
         │     │ (Persist)      │  │ (Start/End)      │
         │     └────────────────┘  └────────┬─────────┘
         │                                  │
         ▼                                  ▼
┌─────────────────────────────────────────────────────────┐
│                    SQLite DB                            │
│  sessions │ daily_summary │ state_log │ session_readings│
└─────────────────────────────────────────────────────────┘
         │                                  │
         ▼                                  ▼
┌──────────────────┐              ┌──────────────────────┐
│  REST API        │              │  MQTT Broker         │
│  /api/live       │              │  HA Discovery        │
│  /api/daily      │              │  Sensor Data         │
│  /api/sessions   │              └──────────────────────┘
└────────┬─────────┘                        │
         │                                  ▼
         ▼                        ┌──────────────────────┐
┌──────────────────┐              │  Home Assistant      │
│  Web Dashboard   │              │  Webhook Events      │
│  (Frontend SPA)  │              └──────────────────────┘
└──────────────────┘
```

Der **Offline-Modus** (`MQTT_HOST=disabled`) erlaubt den reinen Dashboard-Betrieb ohne MQTT-Broker – ideal für erste Tests oder wenn Home Assistant nicht im Einsatz ist.

---

## 🔌 Hardware-Setup

Für die vollständige Verbrauchserfassung kommen neben dem Geschirrspüler zwei externe Sensoren zum Einsatz:

| Komponente | Gerät | Funktion |
|------------|-------|----------|
| **Geschirrspüler** | Bosch Serie 6 (Home Connect) | Programm, Status, Restzeit via WebSocket |
| **Strommessung** | Sonoff Pow R2 (Tasmota) | Echtzeit-Leistung und kWh pro Spülgang |
| **Wasserzähler** | ESP32 + Impulsgeber (ESPHome) | Liter pro Spülgang via HTTP-Sensor |

Die Sensoren werden über HTTP-Polling abgefragt – im aktiven Spülbetrieb alle 30 Sekunden, im Standby alle 120 Sekunden. So entsteht ein lückenloses Verbrauchsprofil für jeden einzelnen Spülgang.

---

## 📊 Session-Tracking – Jeder Spülgang wird dokumentiert

Das Herzstück der Anwendung ist die **automatische Session-Erkennung**. Der `SessionTracker` arbeitet als State-Machine und erkennt anhand von Statusänderungen des Geräts den Beginn und das Ende eines Spülgangs:

1. **Start-Erkennung** – Gerät wechselt von *Standby* auf *Run* → neue Session beginnt
2. **Laufende Erfassung** – Sensor-Readings (Strom, Wasser) werden der Session zugeordnet
3. **Phasen-Erkennung** – Vorspülen, Hauptreinigung, Klarspülen, Trocknung werden identifiziert
4. **End-Erkennung** – Gerät wechselt zurück auf *Ready/Finished* → Session wird abgeschlossen
5. **Persistierung** – Gesamtverbrauch, Dauer, Programm und Kosten werden in SQLite gespeichert

Jede Session enthält:
- Programm-Name und -Nummer
- Start- und Endzeit mit Gesamtdauer
- kWh Stromverbrauch und Liter Wasserverbrauch
- Berechnete Kosten (basierend auf `costs.yaml`-Tarifen)
- Phasen-Verlauf mit Zeitstempeln

---

## 🖥️ Web Dashboard – Live-Ansicht und Historie

Das integrierte Single-Page-Frontend (ES-Module Architektur) bietet zwei Hauptansichten:

### Live-Modus
- Aktueller Gerätezustand mit Programm, Restzeit und Fortschritt
- Echtzeit-Verbrauchskurve des laufenden Spülgangs (Chart.js)
- Tagesverbrauch (kumuliert) mit Kostenanzeige
- Forecast: Hochrechnung des Endverbrauchs basierend auf bisherigem Verlauf

### Historien-Modus
- Tägliche/monatliche/jährliche Zusammenfassungen
- Session-Liste mit Detailansicht
- Verbrauchstrends als Balken- und Liniendiagramme
- CSV-Export aller Sessions
- Perioden-Selektor (Heute, Woche, Monat, Jahr, benutzerdefiniert)

Das Dashboard reagiert responsiv und bietet einen Dark/Light-Theme-Umschalter.

---

## 🔗 Home Assistant Integration

Die Anbindung an Home Assistant erfolgt über zwei Wege:

### MQTT Auto-Discovery
Bei aktiviertem MQTT-Broker registriert sich das Gerät automatisch in Home Assistant. Folgende Entitäten werden angelegt:

- `sensor.dishwasher_state` – Aktueller Betriebszustand
- `sensor.dishwasher_program` – Laufendes Programm
- `sensor.dishwasher_remaining` – Restzeit in Minuten
- `sensor.dishwasher_energy_today` – Tagesverbrauch kWh
- `sensor.dishwasher_water_today` – Tagesverbrauch Liter
- `sensor.dishwasher_sessions_today` – Anzahl Spülgänge heute

### Webhooks
Bei Statusänderungen (Spülgang gestartet/beendet, Fehler) wird ein Event direkt an Home Assistant gesendet – ideal für Automationen wie Push-Benachrichtigungen.

---

## ⚙️ Installation & Konfiguration

### Docker (empfohlen)

```bash
git clone https://github.com/zibous/hc_bosch.git hc_bosch
cd hc_bosch
cp .env.example .env
nano .env                    # Credentials + MQTT setzen
make build && make up
# → Dashboard: http://localhost:5021
```

### Lokale Entwicklung

```bash
pip install -r requirements.txt
python3 main.py
```

### Wichtige Umgebungsvariablen

| Variable | Beschreibung |
|----------|--------------|
| `MQTT_HOST` | Broker-Adresse (`disabled` = nur Dashboard) |
| `BOSCH_EMAIL` / `BOSCH_PASSWORD` | Home Connect Login (nur erstmaliger Key-Austausch) |
| `SENSOR_ENERGY_URL` | Tasmota Sonoff Pow Endpoint |
| `SENSOR_WATER_URL` | ESPHome Wasseruhr Endpoint |
| `HA_WEBHOOK_URL` | Home Assistant Webhook (optional) |
| `FORECAST_ENERGY_MAX_KWH` | Referenzwert für 100% Forecast (Standard: 1.05) |
| `FORECAST_WATER_MAX_L` | Referenzwert für 100% Forecast (Standard: 13.0) |

---

## 📡 REST API – Daten für eigene Projekte

Die FastAPI-Anwendung stellt eine umfangreiche API mit automatischer OpenAPI-Dokumentation bereit (`/docs`):

| Endpoint | Beschreibung |
|----------|--------------|
| `GET /api/live` | Live-Status + Tagesverbrauch + letzte Session |
| `GET /api/session/live` | Chart-Daten der aktuellen Session |
| `GET /api/daily?days=30` | Tägliche Zusammenfassung |
| `GET /api/monthly?year=2026` | Monatliche Zusammenfassung |
| `GET /api/sessions?limit=50` | Session-Liste mit Verbrauchsdaten |
| `GET /api/stats` | Gesamt-Statistiken mit Kosten |
| `GET /api/kpidata` | KPI für zentrales Übersichts-Dashboard |
| `GET /api/export/csv` | CSV-Download aller Sessions |

Alle Endpoints liefern JSON und lassen sich problemlos in Grafana, Node-RED oder eigene Dashboards einbinden.

---

## 🧮 Kostenberechnung

Die Verbrauchskosten werden auf Basis jährlich gepflegter Tarife in `costs.yaml` berechnet:

```yaml
2026:
  energy_kwh: 0.2876    # €/kWh Strom
  water_m3: 4.18        # €/m³ Wasser (inkl. Abwasser)
```

Daraus ergeben sich für einen typischen Spülgang (Eco 50°C):
- **Strom**: ~0,85 kWh × 0,2876 € = **~0,24 €**
- **Wasser**: ~10 Liter × 0,00418 € = **~0,04 €**
- **Gesamt pro Spülgang**: **~0,28 €**

Das Dashboard zeigt diese Kosten live pro Session, pro Tag und als Monatssumme an.

---

## 🛠️ Technische Details

### Projektstruktur (Auszug)

```text
hc_bosch/
├── main.py                    # Entry-Point + Lifecycle
├── app/
│   ├── api/                   # FastAPI Router (Live, History, Combined)
│   ├── core/                  # Config, Logging, Shutdown, Heartbeat
│   ├── device/                # WebSocket, Login, Message-Parser
│   ├── infrastructure/        # MQTT Client, Webhooks, HA Discovery
│   ├── models/                # SQLite DB Manager
│   ├── schemas/               # Pydantic Models (State, Session, KPI)
│   ├── service/               # Session-Tracker, Sensor-Reader, Analytics
│   └── config/                # YAML-Konfig (Geräte, Kosten, Sprache)
├── frontend/                  # SPA (ES-Module, Chart.js)
├── data/                      # SQLite DB + Session-CSVs
└── docker-compose.yml
```

### Technologie-Stack

- **Backend**: Python 3.12, FastAPI, Pydantic v2
- **Datenbank**: SQLite (Zero-Config, Backup-freundlich)
- **Frontend**: Vanilla JS (ES-Modules), Chart.js, CSS Grid
- **Kommunikation**: TLS/PSK WebSocket, MQTT, HTTP REST
- **Deployment**: Docker Compose, Make-basierter Workflow
- **Sensoren**: Tasmota (HTTP), ESPHome (HTTP)

### Graceful Shutdown

Die Anwendung fährt bei SIGINT/SIGTERM sauber herunter: offene Sessions werden geschlossen, MQTT-Verbindungen getrennt und die Datenbank synchronisiert. Kein Datenverlust beim Container-Neustart.

---

## 💡 Erkenntnisse aus dem Betrieb

Nach mehreren Monaten Dauerbetrieb einige interessante Beobachtungen:

- **Eco 50°C** ist tatsächlich am sparsamsten: ~0,85 kWh / ~10 L im Schnitt
- **Intensiv 70°C** verbraucht fast das Doppelte: ~1,5 kWh / ~14 L
- **Quick Wash** spart kaum Wasser, nur Zeit – der kWh-Wert bleibt ähnlich zum Eco-Programm
- Die Trocknung macht ~25% des Gesamtstromverbrauchs aus
- Ein Spülgang pro Tag ergibt Jahreskosten von **~100 € (Strom + Wasser)**

<hr style="margin-bottom: 4rem">

### Dashboard & Verbrauchsanalyse
{{< gallery >}}
  {{< image-dir >}}
{{< /gallery >}}

<hr style="margin-bottom: 4rem">

{{< notice tip >}}
  &raquo; **Offline-Modus:** Mit `MQTT_HOST=disabled` läuft die Anwendung standalone – ideal zum Testen oder wenn kein MQTT-Broker vorhanden ist.<br>
  &raquo; **Sensor-Kalibrierung:** Die Forecast-Werte (`FORECAST_ENERGY_MAX_KWH`, `FORECAST_WATER_MAX_L`) sollten nach einigen Spülgängen an die eigenen Durchschnittswerte angepasst werden.<br>
  &raquo; **Backup:** Die SQLite-Datei `data/dishwasher.db` enthält die komplette Historie – regelmäßig sichern!<br>
{{< /notice >}}

