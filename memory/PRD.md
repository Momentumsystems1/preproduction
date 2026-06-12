# Momentum Road Command Center — Pegasus Edition

## Original problem statement
"PODRIAS CONVERTIR ESTO EN ALGO PROFESIONAL Y ATRACTIVO?"
Refactor of an existing tool that connects to DATEX DGT 3.0 and Servei Català de Trànsit (SCT) and ingests real-time traffic data.

## User choices
- Complete refactor (code + design)
- Modern dark command-center style → upgraded to **Stargate Atlantis Pegasus Gate Diagnostic** HUD aesthetic (deep navy + cyan, monospace, corner brackets, chevron grid, diagnostic stream, tactical tables)
- Map must support **3D / Satellite / Normal** views
- Nearby parking spots (OSM)
- Measure street tool with cursor tracking
- Real-time DGT 3.0 events
- Language: Spanish (with English HUD-style labels: GATE DIAGNOSTICS, SUBROUTINES, SITREC…)

## Architecture
- **Backend**: FastAPI (Python) with async httpx proxies to:
  - DGT 3.0 DATEX2 v36 (`nap.dgt.es/datex2/v3/...`)
  - SCT Catalunya GML (`gencat.cat/transit/opendata/...`)
  - Madrid Abierto KML (`datos.madrid.es/...`)
  - OSM Overpass (parking)
  - Nominatim (geocoding)
  - In-memory cache 90–300 s per source
  - Endpoints: `/api/cities`, `/api/health`, `/api/events`, `/api/parking`, `/api/geocode`
- **Frontend**: React 19 + MapLibre GL JS 4.7 + Tailwind 3.4
  - Single full-viewport command-center component
  - Map styles: CARTO dark raster (Normal), ESRI World Imagery (Satellite), CARTO dark + AWS Terrarium DEM (3D pitch 60°)
- **No database used** (live public feeds only)
- **No API keys required** — all providers are free/public

## What's been implemented (2026-06-12)
- Backend FastAPI with all 6 endpoints working with real data (250+ events from DGT+Madrid in Madrid sector)
- Severity classification (critical/warning/info) and risk scoring
- Auto-refresh every 90 s; health check every 60 s
- Pegasus HUD UI:
  - Header brand + title bar + geocoding search + city selector + LIVE/UTC clock
  - Map style toggle (Normal / Satellite / 3D), measure tool with cursor live tracking + segment/total in meters/km, parking layer toggle, layer filter
  - Left panel: SITREC/RISK/CRIT/WARN/INFO KPI grid, event distribution bars, paginated Situation Record Queue with index + ID + kind
  - Right panel: 36-cell CHEVRON ANALYSIS grid (animated flicker), 12 GTF subroutines with status, data feed status badges
  - Bottom dock: DIAGNOSTIC STREAM (live timestamped log), TACTICAL TABLE (IDX·REC·KIND·SEV·SRC·COORDS click to fly), TELEMETRY (lat/lon/zoom/pitch/bearing/mode/sync)
  - Status bar with DGT/SCT/MADRID/OSM live indicators
  - Diamond-shaped event markers, color-coded by kind, hover popup, click to select
  - Corner brackets, scanline overlay, radar sweep loading state, dotted measure line

## Testing
- Backend: 9/9 pytest passed (iteration_1.json)
- Frontend: 8/8 flows verified via testing agent + manual screenshots
- All map style switches work; measure, parking, search, filter, refresh all functional

## P0 / Done
- [x] DGT 3.0 real-time events
- [x] SCT real-time events
- [x] Madrid municipal events
- [x] 3D / Satellite / Normal map
- [x] Parking nearby (OSM Overpass)
- [x] Measure tool with live cursor tracking
- [x] Pegasus Gate Diagnostic HUD style
- [x] Geocoding search
- [x] Multi-city support (10 Spanish cities)
- [x] Density heatmap (MapLibre heatmap layer, weighted by severity)
- [x] OSRM route optimizer (car/truck/bike/foot, distance + ETA + CO₂ estimate)
- [x] Export GeoJSON (full features) + Export PDF tactical report (jsPDF)

## P1 / Backlog
- Mapillary street view inspection (token required)
- V16 private beacon layer
- Time-series of events (last 24h)
- WebSocket push for instant DGT updates
- Per-event "actions" (assign to operator, escalate)
- Client presentation mode (hide technical panels, big KPIs only)
- Telegram/Slack alerts on critical events

## P2 / Future
- Authentication and role-based access
- Multi-tenant for transport authorities
- Persisted incident annotations (Mongo)
- Email/Slack alerts for critical events
- Historical analytics dashboard

## Files
- `/app/backend/server.py` — FastAPI app and all source fetchers
- `/app/frontend/src/components/CommandCenter.jsx` — full HUD
- `/app/frontend/src/lib/mapStyles.js` — MapLibre style definitions
- `/app/frontend/src/lib/api.js` — axios client
- `/app/frontend/src/index.css` — Atlantis Pegasus theme
