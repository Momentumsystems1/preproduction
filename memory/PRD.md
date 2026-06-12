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

### Update 2026-06-12 (RADICAL UI REDESIGN — Radial Command)
- **Old HUD hidden by default** (toggle with `H` key or "MODO EXPERTO" button).
- **New `RadialCommand` component** (`/app/frontend/src/components/RadialCommand.jsx`) becomes the primary UI:
  - Central draggable orb with **3 skins** (orb / crystal / minimal) cycled via palette button.
  - **3 concentric rings × 6 slots = 18 actions**:
    - OUTER (cyan): Tráfico · Parking · Bicis · EV · Clima · Transporte
    - MIDDLE (amber): Coche · Bus · Bici · Andar · Patinete · Taxi
    - INNER (violet): Origen · Destino · Calcular · Medir · Info · Reset
  - Click a slot → rotates to 12 o'clock; **smart cross-ring links** auto-align the other two rings (e.g. "Tráfico" → Car + Calcular).
  - Drag a ring to manually rotate; snaps to nearest slot on release.
  - Control core can be **dragged anywhere on screen**, **minimized**, or **maximized**.
  - Auto-collapses when pointer leaves a 280 px radius.
- **Map-click → context-aware action**: when inner ring is on "Origen" / "Destino", clicking the map fixes those points (visualised as native GeoJSON markers).
- **Drag control over a traffic incident** → context auto-bound to that feature (queryRenderedFeatures on `events-circle` layer).
- **ENTRAR button** appears when context is set → fires `/api/multimodal/plan` and overlays the 4 ranked alternatives at the bottom of the screen.
- Status chip top-left tracks live state: `LAYER · MODE · ACTION · ORG · DST`.

### Update 2026-06-12 (multimodal trip planner)
- New endpoint **`/api/multimodal/plan`** ranks up to 4 trip combinations by fastest:
  - 100% car (with live Azure traffic delay)
  - Car → parking → walk
  - Car → parking → transit (Google Transit deep-link)
  - 100% transit (deep-link)
- Switched parking discovery from Azure category POI (7311 returned 0 results) to Azure fuzzy POI search → 3+ Madrid parkings now resolved (Carmen, Plaza de Oriente, El Corte Inglés).
- Parallelized the 3 Azure calls inside `/api/multimodal/plan` with `asyncio.gather` (latency 2.5 s → ~0.9 s).
- Event markers migrated from HTML markers to native MapLibre GeoJSON layers (`events-circle` + `events-text`) → zero drift on zoom.
- `RoutePanel` extended with `ALTERNATIVAS MULTIMODALES · AZURE` section showing each option as a card (segments, deeplinks, parkings considered, ★ best, delta_vs_car_min).
- Clicking a multimodal card draws a dashed polyline on the map in the option color and logs `[MMOD] Selected …`.

## Testing
- Backend: 13/13 pytest passed (iteration_2.json — 9 existing + 4 new multimodal tests)
- Frontend: 12/12 flows verified via testing agent + manual screenshots
- All map style switches work; measure, parking, search, filter, refresh, multimodal panel + polyline pick all functional

## P0 / Done
- [x] DGT 3.0 real-time events
- [x] SCT real-time events
- [x] Madrid municipal events
- [x] 3D / Satellite / Normal map
- [x] Parking nearby (OSM Overpass)
- [x] Measure tool with live cursor tracking (fixed anchor drift on zoom)
- [x] Pegasus Gate Diagnostic HUD style
- [x] Geocoding search
- [x] Multi-city support (10 Spanish cities)
- [x] Density heatmap (MapLibre, weighted by severity)
- [x] OSRM route optimizer (car/truck/bike/foot)
- [x] Export GeoJSON + Export PDF tactical report
- [x] **Azure Maps mobility stack** (subscription-key proxied via /api/azure/*):
  - Traffic Flow tile (live road speeds)
  - Traffic Incident tile + Detail JSON
  - Weather Radar tile + Current Conditions chip + Severe Alerts
  - Microsoft Imagery satellite tile
  - Route Directions with live traffic + EV consumption model
  - Route Range (isochrones)
  - POI Search + EV Charging Stations search (with connector filter)
  - Timezone by coordinates

## Security & ops
- All Azure traffic mediated by FastAPI proxy. Subscription key only in backend/.env.
- httpx without verify=False (real TLS verification).
- All popup/marker HTML rendered via DOM API (no innerHTML).
- In-memory cache 60–300 s per Azure endpoint type.

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
