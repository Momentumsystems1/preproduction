import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import debug from "@/lib/debug";
import maplibregl from "maplibre-gl";
import {
  Radio, Layers, Ruler, SquareParking, Search, RotateCw, Mountain, Satellite,
  Map as MapIcon, Activity, Crosshair, Loader2, Eye, X, Hexagon,
  Flame, Download, Route, FileText, FileJson, Maximize2, Minimize2, Bike,
} from "lucide-react";

import { STYLES } from "@/lib/mapStyles";
import { fetchEvents, fetchParking, fetchCities, fetchHealth, geocode, fetchRoute, azureTileUrl, fetchMobilityStations } from "@/lib/api";
import { KIND_ICON, KIND_GLYPH, KIND_LABEL, SEV_COLOR, SUBROUTINES, fmtTime, pad } from "@/lib/hudConstants";
import { KPI, EventRow, EventDetail, StatusPill, SourceBadge } from "@/components/HudPrimitives";
import { riskColor } from "@/lib/styleHelpers";
import RoutePanel from "@/components/RoutePanel";
import BottomDock from "@/components/BottomDock";
import { AzureToolbar, WeatherChip, EVPanel } from "@/components/AzureStack";
import MobilityHub from "@/components/MobilityHub";
import jsPDF from "jspdf";

export default function CommandCenter() {
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const markersRef = useRef([]);
  const parkingMarkersRef = useRef([]);
  const measurePointsRef = useRef([]);
  const measureMarkersRef = useRef([]);
  const measureLineSourceIdRef = useRef("measure-line");
  const hoverPopupRef = useRef(null);

  const [mapStyle, setMapStyle] = useState("normal");
  const [city, setCity] = useState("madrid");
  const [cities, setCities] = useState([]);
  const [eventsData, setEventsData] = useState(null);
  const [parkingData, setParkingData] = useState(null);
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [parkingLoading, setParkingLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [measureMode, setMeasureMode] = useState(false);
  const [measureDistance, setMeasureDistance] = useState(0);
  const [cursorMeasure, setCursorMeasure] = useState(null);
  const [showParking, setShowParking] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showRoutePanel, setShowRoutePanel] = useState(false);
  const [routeFrom, setRouteFrom] = useState("");
  const [routeTo, setRouteTo] = useState("");
  const [routeMode, setRouteMode] = useState("car");
  const [routeResult, setRouteResult] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  // Azure Maps stack toggles
  const [showAzureFlow, setShowAzureFlow] = useState(false);
  const [showAzureIncidents, setShowAzureIncidents] = useState(false);
  const [showAzureWeather, setShowAzureWeather] = useState(false);
  const [showAzureSat, setShowAzureSat] = useState(false);
  const [showEVPanel, setShowEVPanel] = useState(false);
  const [showMobility, setShowMobility] = useState(false);
  const [showMobilityHub, setShowMobilityHub] = useState(false);
  const [mobilityData, setMobilityData] = useState(null);
  const [focusMode, setFocusMode] = useState(false);
  const mobilityMarkersRef = useRef([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterKind, setFilterKind] = useState("all");
  const [pitch, setPitch] = useState(0);
  const [zoom, setZoom] = useState(11);
  const [bearing, setBearing] = useState(0);
  const [mapCenter, setMapCenter] = useState({ lat: 40.41678, lng: -3.70379 });
  const [lastUpdate, setLastUpdate] = useState(null);
  const [clock, setClock] = useState(new Date());

  // diagnostic stream log
  const [logs, setLogs] = useState([]);
  const addLog = useCallback((msg, kind = "info") => {
    setLogs((l) => [{ id: Date.now() + Math.random(), msg, kind, t: new Date() }, ...l].slice(0, 24));
  }, []);

  // clock
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ---- init map ----
  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: STYLES[mapStyle].style,
      center: [-3.70379, 40.41678],
      zoom: 11,
      pitch: 0,
      bearing: 0,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

    map.on("pitch", () => setPitch(Math.round(map.getPitch())));
    map.on("zoom", () => setZoom(map.getZoom().toFixed(2)));
    map.on("rotate", () => setBearing(Math.round(map.getBearing())));
    map.on("move", () => {
      const c = map.getCenter();
      setMapCenter({ lat: c.lat, lng: c.lng });
    });

    addLog("[CORE] Map subsystem initialized", "ok");
    addLog("[NET ] Connecting to DGT 3.0 DATEX2 stream...", "info");

    return () => { map.remove(); mapRef.current = null; };
    // Intentional run-once: map should only be initialised once at mount.
    // `mapStyle`, `addLog`, etc. are handled by dedicated effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- style change ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const styleDef = STYLES[mapStyle].style;
    map.setStyle(styleDef);
    map.once("styledata", () => {
      if (mapStyle === "threed") {
        try {
          map.setTerrain({ source: "terrain-rgb", exaggeration: 1.4 });
          map.easeTo({ pitch: 60, bearing: -17, duration: 1200 });
        } catch (e) {
          debug("setTerrain failed (3D unavailable):", e);
        }
      } else {
        try { map.setTerrain(null); } catch (e) {
          debug("setTerrain(null) failed:", e);
        }
        map.easeTo({ pitch: 0, bearing: 0, duration: 800 });
      }
      renderEventMarkers(eventsData);
      renderParkingMarkers(parkingData);
      // Restore Azure raster overlays after style swap
      ensureAzureLayer("flow", showAzureFlow);
      ensureAzureLayer("incident", showAzureIncidents);
      ensureAzureLayer("weather", showAzureWeather);
      ensureAzureLayer("satellite", showAzureSat);
    });
    addLog(`[VIEW] Switching render mode → ${mapStyle.toUpperCase()}`, "info");
    // Intentional: the styledata callback above reads the latest state via closure
    // when it fires AFTER setStyle finishes. Adding eventsData/parking/Azure toggles
    // as deps would re-run setStyle every time any of them changes (= the whole map
    // re-loads on every event refresh — undesired).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapStyle]);

  // ---- load cities + health ----
  useEffect(() => {
    fetchCities().then(setCities).catch(() => {});
    const refreshHealth = () => fetchHealth().then((h) => {
      setHealthData(h);
      addLog(`[NET ] Source diagnostic completed: DGT=${h.sources?.["DGT 3.0"]} SCT=${h.sources?.SCT} MAD=${h.sources?.Madrid}`, "ok");
    }).catch(() => addLog("[NET ] Health check failed", "err"));
    refreshHealth();
    const t = setInterval(refreshHealth, 60000);
    return () => clearInterval(t);
    // Intentional run-once: cities and health are bootstrapped at mount.
    // `addLog` is stable (useCallback with []) so it's safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- load events ----
  const loadEvents = useCallback(async (cityId) => {
    setLoading(true);
    addLog(`[NET ] Querying DGT 3.0 for sector ${cityId.toUpperCase()}...`, "info");
    try {
      const data = await fetchEvents(cityId);
      setEventsData(data);
      setLastUpdate(new Date());
      addLog(`[DATA] Ingested ${data.count} situation records · risk=${data.risk}`, "ok");
      addLog(`[CLS ] Severity matrix: CRIT=${data.severity.critical} WARN=${data.severity.warning} INFO=${data.severity.info}`, "ok");
      if (mapRef.current && data.center) {
        mapRef.current.easeTo({ center: [data.center.lon, data.center.lat], zoom: 11.5, duration: 1000 });
      }
    } catch (e) {
      addLog(`[ERR ] Failed to fetch events: ${e.message}`, "err");
    } finally {
      setLoading(false);
    }
  }, [addLog]);

  useEffect(() => { loadEvents(city); }, [city, loadEvents]);

  // auto refresh
  useEffect(() => {
    const t = setInterval(() => loadEvents(city), 90_000);
    return () => clearInterval(t);
  }, [city, loadEvents]);

  // ---- markers ----
  const filteredFeatures = useMemo(() => {
    if (!eventsData) return [];
    if (filterKind === "all") return eventsData.features;
    return eventsData.features.filter((f) => f.kind === filterKind);
  }, [eventsData, filterKind]);

  const renderEventMarkers = useCallback((data) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // Clean up any legacy HTML markers from previous versions
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const SRC = "events-src";
    const CIRC = "events-circle";
    const TXT = "events-text";

    const feats = !data ? [] : (filterKind === "all"
      ? data.features
      : data.features.filter((f) => f.kind === filterKind));

    const fc = {
      type: "FeatureCollection",
      features: feats.map((f) => ({
        type: "Feature",
        properties: {
          id: f.id, kind: f.kind, severity: f.severity,
          road: f.road, source: f.source,
          title: f.title, description: f.description,
        },
        geometry: { type: "Point", coordinates: [f.lon, f.lat] },
      })),
    };

    if (map.getSource(SRC)) {
      map.getSource(SRC).setData(fc);
    } else {
      map.addSource(SRC, { type: "geojson", data: fc });
      map.addLayer({
        id: CIRC,
        type: "circle",
        source: SRC,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 5, 14, 10, 18, 14],
          "circle-color": ["match", ["get", "kind"],
            "accidente",  "#ef4444",
            "obras",      "#fbbf24",
            "congestion", "#c084fc",
            "peligro",    "#fb923c",
            "meteo",      "#22d3ee",
            "incidencia", "#67e8f9",
            /* fallback */ "#67e8f9",
          ],
          "circle-stroke-color": "rgba(2,10,20,0.85)",
          "circle-stroke-width": 1.5,
          "circle-opacity": 0.95,
        },
      });
      map.addLayer({
        id: TXT,
        type: "symbol",
        source: SRC,
        layout: {
          "text-field": ["match", ["get", "kind"],
            "accidente",  "X",
            "obras",      "!",
            "congestion", "≋",
            "peligro",    "▲",
            "meteo",      "~",
            "incidencia", "i",
            "i",
          ],
          "text-size": ["interpolate", ["linear"], ["zoom"], 8, 8, 14, 11, 18, 14],
          "text-font": ["Noto Sans Regular"],
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: {
          "text-color": "#02101a",
          "text-halo-color": "rgba(0,0,0,0)",
        },
      });

      // Click handler — same as before
      map.on("click", CIRC, (ev) => {
        const f = ev.features?.[0];
        if (!f) return;
        const props = f.properties;
        const [lon, lat] = f.geometry.coordinates;
        const evt = { ...props, lat, lon };
        setSelected(evt);
        addLog(`[SEL ] Target acquired ${props.id} (${(props.kind || "incidencia").toUpperCase()})`, "info");
        map.easeTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 13), duration: 600 });
      });

      // Cursor hover
      map.on("mouseenter", CIRC, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", CIRC, () => { map.getCanvas().style.cursor = ""; });
    }
  }, [filterKind, addLog]);

  useEffect(() => { renderEventMarkers(eventsData); }, [eventsData, filterKind, renderEventMarkers]);

  // ---- parking ----
  const renderParkingMarkers = useCallback((data) => {
    const map = mapRef.current;
    if (!map) return;
    parkingMarkersRef.current.forEach((m) => m.remove());
    parkingMarkersRef.current = [];
    if (!data || !showParking) return;
    data.features.forEach((p) => {
      const el = document.createElement("div");
      el.className = "mrc-marker parking";
      el.setAttribute("data-testid", `parking-marker-${p.id}`);
      const pSpan = document.createElement("span");
      pSpan.textContent = "P";
      el.appendChild(pSpan);
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        setSelected({
          id: p.id, kind: "parking", title: p.name || "Parking",
          description: `Plazas estimadas libres: ${p.available_estimate}${p.capacity ? ` / ${p.capacity}` : ""} · ${p.fee !== "unknown" ? `Tarifa: ${p.fee}` : "Tarifa no especificada"}`,
          source: "OPENSTREETMAP", road: p.operator || "OSM",
          lat: p.lat, lon: p.lon, severity: "info",
        });
      });
      const marker = new maplibregl.Marker({ element: el }).setLngLat([p.lon, p.lat]).addTo(map);
      parkingMarkersRef.current.push(marker);
    });
  }, [showParking]);

  useEffect(() => { renderParkingMarkers(parkingData); }, [parkingData, showParking, renderParkingMarkers]);

  const loadParkingHere = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    const c = map.getCenter();
    setParkingLoading(true);
    setShowParking(true);
    addLog("[NET ] Querying OSM Overpass for parking aggregator...", "info");
    try {
      const data = await fetchParking(c.lat, c.lng, 1500);
      setParkingData(data);
      addLog(`[DATA] Parking subsystem: ${data.count} nodes · ~${data.available_total_estimate} stalls`, "ok");
    } catch (e) {
      addLog(`[ERR ] Parking fetch failed: ${e.message}`, "err");
    } finally { setParkingLoading(false); }
  }, [addLog]);

  const toggleParking = useCallback(() => {
    if (showParking) { setShowParking(false); setParkingData(null); addLog("[VIEW] Parking layer disabled", "info"); }
    else loadParkingHere();
  }, [showParking, loadParkingHere, addLog]);

  // ---- measure ----
  const haversineMeters = (a, b) => {
    const R = 6371000;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLon = ((b.lng - a.lng) * Math.PI) / 180;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  };

  const updateMeasureLine = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const id = measureLineSourceIdRef.current;
    const coords = measurePointsRef.current.map((p) => [p.lng, p.lat]);
    const geo = { type: "Feature", geometry: { type: "LineString", coordinates: coords } };
    if (map.getSource(id)) {
      map.getSource(id).setData(geo);
    } else {
      map.addSource(id, { type: "geojson", data: geo });
      map.addLayer({
        id: id + "-line", type: "line", source: id,
        paint: { "line-color": "#22d3ee", "line-width": 3, "line-dasharray": [2, 1] },
      });
    }
    let total = 0;
    for (let i = 1; i < coords.length; i++) {
      total += haversineMeters({ lng: coords[i - 1][0], lat: coords[i - 1][1] }, { lng: coords[i][0], lat: coords[i][1] });
    }
    setMeasureDistance(total);
  }, []);

  const clearMeasure = useCallback(() => {
    const map = mapRef.current;
    measurePointsRef.current = [];
    measureMarkersRef.current.forEach((m) => m.remove());
    measureMarkersRef.current = [];
    if (map && map.getLayer(measureLineSourceIdRef.current + "-line")) {
      map.removeLayer(measureLineSourceIdRef.current + "-line");
    }
    if (map && map.getSource(measureLineSourceIdRef.current)) {
      map.removeSource(measureLineSourceIdRef.current);
    }
    setMeasureDistance(0);
    setCursorMeasure(null);
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const onClick = (e) => {
      if (!measureMode) return;
      const pt = e.lngLat;
      measurePointsRef.current.push(pt);
      const el = document.createElement("div");
      el.style.cssText = "width:10px;height:10px;background:#22d3ee;border:2px solid #02101a;box-shadow:0 0 10px rgba(34,211,238,0.8)";
      const marker = new maplibregl.Marker({ element: el }).setLngLat(pt).addTo(map);
      measureMarkersRef.current.push(marker);
      updateMeasureLine();
    };
    const onMouseMove = (e) => {
      if (!measureMode) { setCursorMeasure(null); return; }
      const pts = measurePointsRef.current;
      if (pts.length === 0) {
        setCursorMeasure({ lng: e.lngLat.lng, lat: e.lngLat.lat, segment: 0, total: 0 });
        return;
      }
      const last = pts[pts.length - 1];
      const seg = haversineMeters({ lng: last.lng, lat: last.lat }, { lng: e.lngLat.lng, lat: e.lngLat.lat });
      let tot = 0;
      for (let i = 1; i < pts.length; i++) {
        tot += haversineMeters({ lng: pts[i - 1].lng, lat: pts[i - 1].lat }, { lng: pts[i].lng, lat: pts[i].lat });
      }
      setCursorMeasure({ lng: e.lngLat.lng, lat: e.lngLat.lat, segment: seg, total: tot + seg });
    };
    const onMouseOut = () => setCursorMeasure(null);
    map.on("click", onClick);
    map.on("mousemove", onMouseMove);
    map.on("mouseout", onMouseOut);
    map.getCanvas().style.cursor = measureMode ? "crosshair" : "";
    return () => { map.off("click", onClick); map.off("mousemove", onMouseMove); map.off("mouseout", onMouseOut); };
  }, [measureMode, updateMeasureLine]);

  const toggleMeasure = () => {
    if (measureMode) { clearMeasure(); setMeasureMode(false); addLog("[TOOL] Measure tool disabled", "info"); }
    else { setMeasureMode(true); addLog("[TOOL] Measure tool armed · click points on map", "info"); }
  };

  // ---- Azure raster tile layers ----
  const ensureAzureLayer = useCallback((kind, visible) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const srcId = `azure-${kind}-src`;
    const layerId = `azure-${kind}-layer`;
    const hasSrc = !!map.getSource(srcId);
    if (visible) {
      if (!hasSrc) {
        map.addSource(srcId, {
          type: "raster",
          tiles: [azureTileUrl(kind)],
          tileSize: 256,
          attribution: "© Microsoft Azure Maps",
        });
        // satellite goes below everything; others above basemap
        map.addLayer({
          id: layerId,
          type: "raster",
          source: srcId,
          paint: { "raster-opacity": kind === "weather" ? 0.65 : kind === "satellite" ? 1.0 : 0.85 },
        });
      } else if (!map.getLayer(layerId)) {
        map.addLayer({
          id: layerId,
          type: "raster",
          source: srcId,
          paint: { "raster-opacity": kind === "weather" ? 0.65 : kind === "satellite" ? 1.0 : 0.85 },
        });
      }
    } else {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(srcId)) map.removeSource(srcId);
    }
  }, []);

  useEffect(() => { ensureAzureLayer("flow", showAzureFlow); }, [showAzureFlow, ensureAzureLayer, mapStyle]);
  useEffect(() => { ensureAzureLayer("incident", showAzureIncidents); }, [showAzureIncidents, ensureAzureLayer, mapStyle]);
  useEffect(() => { ensureAzureLayer("weather", showAzureWeather); }, [showAzureWeather, ensureAzureLayer, mapStyle]);
  useEffect(() => { ensureAzureLayer("satellite", showAzureSat); }, [showAzureSat, ensureAzureLayer, mapStyle]);

  // ---- Mobility (bike-share) markers ----
  const renderMobilityMarkers = useCallback((data) => {
    const map = mapRef.current;
    if (!map) return;
    mobilityMarkersRef.current.forEach((m) => m.remove());
    mobilityMarkersRef.current = [];
    if (!data || !showMobility) return;
    data.stations.slice(0, 200).forEach((s) => {
      const el = document.createElement("div");
      el.style.cssText = `width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;color:#02101a;cursor:pointer;border:1px solid rgba(2,10,20,0.6);box-shadow:0 4px 10px rgba(0,0,0,0.4);background:${s.bikes > 3 ? "#4ade80" : s.bikes >= 1 ? "#fbbf24" : "#71717a"};border-radius:3px`;
      el.setAttribute("data-testid", `mob-marker-${s.id}`);
      const span = document.createElement("span");
      span.textContent = String(s.bikes);
      el.appendChild(span);
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        setSelected({
          id: s.id, kind: "bicis", title: `${s.bikes} bicis disponibles`,
          description: `${s.bikes} bicis libres · ${s.slots} huecos libres${s.ebikes ? ` · ${s.ebikes} eléctricas` : ""} · ${s.network_name}`,
          source: s.network_name, road: s.name,
          lat: s.lat, lon: s.lon, severity: "info",
        });
      });
      const m = new maplibregl.Marker({ element: el }).setLngLat([s.lon, s.lat]).addTo(map);
      mobilityMarkersRef.current.push(m);
    });
  }, [showMobility]);

  useEffect(() => { renderMobilityMarkers(mobilityData); }, [mobilityData, showMobility, renderMobilityMarkers, mapStyle]);

  const loadMobilityHere = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    const c = map.getCenter();
    addLog("[MOB ] Querying GBFS networks (CityBikes)...", "info");
    try {
      const d = await fetchMobilityStations(c.lat, c.lng, 3.0);
      setMobilityData(d);
      addLog(`[MOB ] ${d.count} stations across ${d.networks_count} networks`, "ok");
    } catch (e) {
      addLog(`[ERR ] Mobility fetch failed: ${e.message}`, "err");
    }
  }, [addLog]);

  const toggleMobility = useCallback(() => {
    if (showMobility) {
      setShowMobility(false);
      setMobilityData(null);
      addLog("[MOB ] Mobility layer disabled", "info");
    } else {
      setShowMobility(true);
      loadMobilityHere();
    }
  }, [showMobility, loadMobilityHere, addLog]);

  // ---- heatmap ----
  const HEATMAP_SOURCE = "heatmap-events";
  const HEATMAP_LAYER = "heatmap-events-layer";

  const renderHeatmap = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    // remove first
    if (map.getLayer(HEATMAP_LAYER)) map.removeLayer(HEATMAP_LAYER);
    if (map.getSource(HEATMAP_SOURCE)) map.removeSource(HEATMAP_SOURCE);
    if (!showHeatmap || !eventsData) return;

    const fc = {
      type: "FeatureCollection",
      features: eventsData.features.map((f) => ({
        type: "Feature",
        properties: {
          weight: f.severity === "critical" ? 3 : f.severity === "warning" ? 2 : 1,
        },
        geometry: { type: "Point", coordinates: [f.lon, f.lat] },
      })),
    };
    map.addSource(HEATMAP_SOURCE, { type: "geojson", data: fc });
    map.addLayer({
      id: HEATMAP_LAYER,
      type: "heatmap",
      source: HEATMAP_SOURCE,
      maxzoom: 16,
      paint: {
        "heatmap-weight": ["interpolate", ["linear"], ["get", "weight"], 1, 0.4, 3, 1],
        "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 16, 3],
        "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 8, 16, 50],
        "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0.85, 16, 0.55],
        "heatmap-color": [
          "interpolate", ["linear"], ["heatmap-density"],
          0,    "rgba(34, 211, 238, 0)",
          0.15, "rgba(34, 211, 238, 0.45)",
          0.35, "rgba(125, 211, 252, 0.7)",
          0.55, "rgba(251, 191, 36, 0.85)",
          0.75, "rgba(249, 115, 22, 0.9)",
          1.0,  "rgba(239, 68, 68, 0.95)",
        ],
      },
    });
  }, [showHeatmap, eventsData]);

  useEffect(() => { renderHeatmap(); }, [renderHeatmap, mapStyle]);

  const toggleHeatmap = () => {
    setShowHeatmap((v) => {
      const nv = !v;
      addLog(`[TOOL] Density heatmap ${nv ? "engaged" : "disabled"}`, "info");
      return nv;
    });
  };

  // ---- route (OSRM) ----
  const ROUTE_SOURCE = "route-line";
  const ROUTE_LAYER = "route-line-layer";

  const drawRoute = useCallback((geometry) => {
    const map = mapRef.current;
    if (!map) return;
    if (map.getLayer(ROUTE_LAYER)) map.removeLayer(ROUTE_LAYER);
    if (map.getSource(ROUTE_SOURCE)) map.removeSource(ROUTE_SOURCE);
    if (!geometry) return;
    map.addSource(ROUTE_SOURCE, {
      type: "geojson",
      data: { type: "Feature", properties: {}, geometry },
    });
    map.addLayer({
      id: ROUTE_LAYER,
      type: "line",
      source: ROUTE_SOURCE,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#fbbf24", "line-width": 5, "line-opacity": 0.85 },
    });
    // fit bounds
    const coords = geometry.coordinates;
    if (coords && coords.length) {
      const lons = coords.map((c) => c[0]);
      const lats = coords.map((c) => c[1]);
      const bounds = [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]];
      map.fitBounds(bounds, { padding: { top: 200, bottom: 220, left: 380, right: 380 }, duration: 1200 });
    }
  }, []);

  const clearRoute = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.getLayer(ROUTE_LAYER)) map.removeLayer(ROUTE_LAYER);
    if (map.getSource(ROUTE_SOURCE)) map.removeSource(ROUTE_SOURCE);
    setRouteResult(null);
  }, []);

  const runRoute = async () => {
    if (!routeFrom.trim() || !routeTo.trim()) {
      addLog("[ROUTE] Origin and destination required", "err");
      return;
    }
    setRouteLoading(true);
    addLog(`[ROUTE] Optimizing ${routeMode.toUpperCase()} route...`, "info");
    try {
      const r = await fetchRoute(routeFrom, routeTo, routeMode);
      setRouteResult(r);
      drawRoute(r.geometry);
      addLog(`[ROUTE] ${r.distance_km}km · ${r.duration_min}min · CO₂≈${r.co2_g}g`, "ok");
    } catch (e) {
      const msg = e.response?.data?.detail || e.message;
      addLog(`[ROUTE] ${msg}`, "err");
      setRouteResult({ error: msg });
    } finally {
      setRouteLoading(false);
    }
  };

  // ---- export GeoJSON / PDF ----
  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  const exportGeoJSON = () => {
    if (!eventsData) return;
    const fc = {
      type: "FeatureCollection",
      generator: "Momentum Road Command Center · Pegasus v2.0",
      generated_at: new Date().toISOString(),
      city: eventsData.city,
      count: eventsData.count,
      risk: eventsData.risk,
      features: eventsData.features.map((f) => ({
        type: "Feature",
        properties: {
          id: f.id, kind: f.kind, severity: f.severity,
          title: f.title, description: f.description,
          road: f.road, source: f.source, timestamp: f.timestamp,
        },
        geometry: { type: "Point", coordinates: [f.lon, f.lat] },
      })),
    };
    const blob = new Blob([JSON.stringify(fc, null, 2)], { type: "application/geo+json" });
    downloadBlob(blob, `mrc_${eventsData.city}_${new Date().toISOString().slice(0, 19).replace(/:/g, "")}.geojson`);
    addLog(`[EXP ] GeoJSON export · ${fc.features.length} features`, "ok");
    setExportOpen(false);
  };

  const exportPDF = () => {
    if (!eventsData) return;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const PAGE_H = doc.internal.pageSize.getHeight();

    // background header
    doc.setFillColor(2, 10, 20);
    doc.rect(0, 0, W, 90, "[ ESPERANDO DATOS ]");
    doc.setTextColor(34, 211, 238);
    doc.setFont("courier", "bold").setFontSize(18);
    doc.text("MOMENTUM ROAD COMMAND CENTER", 40, 38);
    doc.setFont("courier", "normal").setFontSize(9);
    doc.text("PEGASUS · GATE DIAGNOSTICS · TACTICAL REPORT", 40, 56);
    doc.setTextColor(125, 211, 252);
    doc.text(`SECTOR: ${(eventsData.city || "—").toUpperCase()}    GENERATED: ${new Date().toISOString().replace("[ SIN INCIDENCIAS EN EL SECTOR ]", "[ SIN INCIDENCIAS EN EL SECTOR ]").slice(0, 19)} UTC`, 40, 74);

    // summary
    let y = 120;
    doc.setTextColor(34, 211, 238);
    doc.setFont("courier", "bold").setFontSize(11);
    doc.text("SUMMARY", 40, y);
    doc.setDrawColor(34, 211, 238);
    doc.line(40, y + 4, W - 40, y + 4);
    y += 22;

    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "normal").setFontSize(10);
    const rows = [
      ["Total situation records", String(eventsData.count)],
      ["Risk level", eventsData.risk],
      ["Critical events", String(eventsData.severity.critical || 0)],
      ["Warning events", String(eventsData.severity.warning || 0)],
      ["Info events", String(eventsData.severity.info || 0)],
      ["Radius", `${eventsData.radius_km} km`],
      ["Center", `${eventsData.center.lat.toFixed(5)}, ${eventsData.center.lon.toFixed(5)}`],
      ["Data sources", Object.entries(eventsData.sources).map(([k, v]) => `${k}: ${v}`).join("  ·  ")],
    ];
    rows.forEach(([k, v]) => {
      doc.setFont("courier", "bold"); doc.text(k, 40, y);
      doc.setFont("courier", "normal"); doc.text(v, 220, y);
      y += 16;
    });

    // route if any
    if (routeResult && !routeResult.error) {
      y += 8;
      doc.setTextColor(34, 211, 238);
      doc.setFont("courier", "bold").setFontSize(11);
      doc.text("ROUTE OPTIMIZATION", 40, y);
      doc.line(40, y + 4, W - 40, y + 4);
      y += 22;
      doc.setTextColor(20, 20, 20).setFont("courier", "normal").setFontSize(10);
      [
        ["Origin", routeResult.from?.display_name || routeFrom],
        ["Destination", routeResult.to?.display_name || routeTo],
        ["Mode", routeResult.mode],
        ["Distance", `${routeResult.distance_km} km`],
        ["Duration", `${routeResult.duration_min} min`],
        ["Estimated CO₂", `${routeResult.co2_g} g`],
      ].forEach(([k, v]) => {
        doc.setFont("courier", "bold"); doc.text(k, 40, y);
        doc.setFont("courier", "normal"); doc.text(String(v).slice(0, 60), 220, y);
        y += 16;
      });
    }

    // top events table
    y += 12;
    doc.setTextColor(34, 211, 238).setFont("courier", "bold").setFontSize(11);
    doc.text("TOP EVENTS · TACTICAL TABLE", 40, y);
    doc.line(40, y + 4, W - 40, y + 4);
    y += 18;

    doc.setFont("courier", "bold").setFontSize(8).setTextColor(60, 60, 60);
    doc.text("IDX", 40, y); doc.text("ID", 70, y);
    doc.text("KIND", 150, y); doc.text("SEV", 230, y);
    doc.text("SRC", 280, y); doc.text("ROAD", 360, y); doc.text("COORD", 500, y);
    y += 4;
    doc.setDrawColor(180, 180, 180);
    doc.line(40, y, W - 40, y);
    y += 12;

    doc.setFont("courier", "normal").setFontSize(8).setTextColor(20, 20, 20);
    const list = eventsData.features.slice(0, 80);
    list.forEach((f, i) => {
      if (y > PAGE_H - 60) { doc.addPage(); y = 60; }
      doc.text(String(i + 1).padStart(3, "0"), 40, y);
      doc.text((f.id || "").slice(0, 14), 70, y);
      doc.text((f.kind || "").toUpperCase(), 150, y);
      doc.text((f.severity || "").toUpperCase(), 230, y);
      doc.text((f.source || "").split("[ SIN INCIDENCIAS EN EL SECTOR ]")[0], 280, y);
      doc.text((f.road || "").slice(0, 26), 360, y);
      doc.text(`${f.lat.toFixed(3)},${f.lon.toFixed(3)}`, 500, y);
      y += 12;
    });

    // footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.setFontSize(8).setTextColor(120, 120, 120).setFont("courier", "normal");
      doc.text(`Momentum Road Command Center · Pegasus v2.0 · page ${p}/${pageCount}`, W / 2, PAGE_H - 20, { align: "center" });
    }

    doc.save(`mrc_${eventsData.city}_${new Date().toISOString().slice(0, 19).replace(/:/g, "")}.pdf`);
    addLog(`[EXP ] PDF tactical report generated · ${list.length} rows`, "ok");
    setExportOpen(false);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    addLog(`[NET ] Geocoding "${searchQuery}"...`, "info");
    try {
      const r = await geocode(searchQuery);
      if (mapRef.current && r) {
        mapRef.current.flyTo({ center: [r.lon, r.lat], zoom: 14, duration: 1200 });
        addLog(`[NAV ] Locked on ${r.display_name.slice(0, 40)}`, "ok");
      }
    } catch (e) { addLog(`[ERR ] Geocode miss: ${e.message}`, "err"); }
  };

  const locateMe = () => {
    if (!navigator.geolocation || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      mapRef.current.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 15, duration: 1200 });
      addLog("[NAV ] Centered on operator position", "ok");
    });
  };

  const kpi = useMemo(() => {
    if (!eventsData) return { count: 0, critical: 0, warning: 0, info: 0, risk: "—" };
    return {
      count: eventsData.count,
      critical: eventsData.severity?.critical || 0,
      warning: eventsData.severity?.warning || 0,
      info: eventsData.severity?.info || 0,
      risk: eventsData.risk,
    };
  }, [eventsData]);

  const kinds = useMemo(() => {
    if (!eventsData) return [];
    const c = {};
    eventsData.features.forEach((f) => { c[f.kind] = (c[f.kind] || 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  }, [eventsData]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#020a14]" data-testid="command-center">
      {/* MAP */}
      <div ref={mapContainerRef} className="absolute inset-0" data-testid="map-container" />

      {/* Scanline overlay */}
      <div className="scanline" style={{ top: 0 }} />

      {/* ===== TOP HEADER ===== */}
      <header className="absolute top-0 left-0 right-0 z-50 panel border-x-0 border-t-0" data-testid="top-header">
        <div className="flex items-stretch">
          {/* Brand block */}
          <div className="flex items-center gap-3 px-5 py-3 border-r border-cyan-500/20">
            <div className="gate-ring">
              <Hexagon className="w-4 h-4 text-cyan-300" />
            </div>
            <div className="leading-none">
              <div className="font-display font-semibold text-[16px] tracking-[0.18em] text-cyan-100">MOMENTUM</div>
              <div className="font-mono text-[10px] tracking-[0.32em] text-cyan-400/70 mt-1">PEGASUS · ROAD COMMAND</div>
            </div>
          </div>

          {/* Title row */}
          <div className="flex-1 px-5 py-2.5 border-r border-cyan-500/20">
            <div className="flex items-center gap-3">
              <div className="font-mono text-[10px] tracking-[0.28em] text-cyan-300/80">GATE DIAGNOSTICS · TRAFFIC SUBSYSTEM</div>
              <div className="h-3 w-px bg-cyan-500/30" />
              <div className="font-mono text-[10px] tracking-[0.22em] text-cyan-200">SUBSYSTEM ANALYSIS · ALPHA V.2</div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/5 border border-cyan-500/25 flex-1 max-w-2xl">
                <Search className="w-3.5 h-3.5 text-cyan-400/70 flex-shrink-0" />
                <input
                  data-testid="search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="BÚSQUEDA: dirección, carretera, punto operativo"
                  className="bg-transparent outline-none text-xs font-mono flex-1 placeholder:text-cyan-700/70 text-cyan-100"
                />
                <button data-testid="search-go-btn" onClick={handleSearch}
                  className="font-mono text-[10px] tracking-[0.18em] text-cyan-300 hover:text-cyan-100 px-2 py-0.5 border border-cyan-500/40 bg-cyan-500/10">
                  EXEC
                </button>
              </div>
              <button data-testid="locate-btn" onClick={locateMe} title="Centrar en mi posición"
                className="p-1.5 bg-cyan-500/5 hover:bg-cyan-500/15 border border-cyan-500/25">
                <Crosshair className="w-3.5 h-3.5 text-cyan-300" />
              </button>
            </div>
          </div>

          {/* City + Refresh */}
          <div className="flex items-center gap-2 px-4 py-3 border-r border-cyan-500/20">
            <div>
              <div className="font-mono text-[9px] tracking-[0.22em] text-cyan-500/80 mb-1">SECTOR</div>
              <select
                data-testid="city-select"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="bg-cyan-500/5 border border-cyan-500/30 px-2 py-1 text-xs font-mono text-cyan-100 outline-none cursor-pointer hover:border-cyan-500/60">
                {cities.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#020a14]">{c.name}</option>
                ))}
              </select>
            </div>
            <button data-testid="refresh-btn" onClick={() => loadEvents(city)}
              className="flex items-center gap-1.5 px-3 py-2 mt-3 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/40 text-cyan-100 text-xs font-mono tracking-wide transition-colors">
              <RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden md:inline">RECARGAR</span>
            </button>
          </div>

          {/* Live + Clock */}
          <div className="flex items-center gap-4 px-5 py-3">
            <div>
              <div className="font-mono text-[9px] tracking-[0.22em] text-cyan-500/80 mb-1">FEED</div>
              <div className="flex items-center gap-2">
                <div className="live-dot" />
                <div className="font-mono text-xs tracking-[0.2em] text-cyan-300">LIVE</div>
              </div>
            </div>
            <div className="border-l border-cyan-500/20 pl-4">
              <div className="font-mono text-[9px] tracking-[0.22em] text-cyan-500/80 mb-1">UTC</div>
              <div className="font-mono text-sm tracking-tight text-cyan-100 tabular-nums" data-testid="last-update">
                {fmtTime(clock)}
              </div>
            </div>
          </div>
        </div>

        {/* Sub-toolbar */}
        <div className="flex items-center gap-3 px-5 py-2 border-t border-cyan-500/15 bg-cyan-500/3">
          <div className="flex items-center gap-0 border border-cyan-500/30">
            {Object.values(STYLES).map((s) => (
              <button key={s.id}
                data-testid={`map-style-${s.id}`}
                onClick={() => setMapStyle(s.id)}
                className={`flex items-center gap-1.5 px-3 py-1 text-[11px] font-mono tracking-wide transition-colors ${mapStyle === s.id ? "bg-cyan-400 text-[#020a14]" : "text-cyan-300 hover:bg-cyan-500/10"}`}>
                {s.id === "normal" && <MapIcon className="w-3 h-3" />}
                {s.id === "satellite" && <Satellite className="w-3 h-3" />}
                {s.id === "threed" && <Mountain className="w-3 h-3" />}
                {s.label.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            data-testid="measure-btn"
            onClick={toggleMeasure}
            className={`flex items-center gap-1.5 px-3 py-1 text-[11px] font-mono tracking-wide border transition-colors ${measureMode ? "bg-cyan-400 text-[#020a14] border-cyan-400" : "bg-transparent border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10"}`}>
            <Ruler className="w-3 h-3" />
            MEASURE {measureMode ? "· ON" : ""}
          </button>

          {measureMode && (
            <button data-testid="clear-measure-btn" onClick={clearMeasure}
              className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-mono tracking-wide bg-transparent border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10">
              <X className="w-3 h-3" /> CLEAR
            </button>
          )}

          <button data-testid="parking-btn" onClick={toggleParking}
            className={`flex items-center gap-1.5 px-3 py-1 text-[11px] font-mono tracking-wide border transition-colors ${showParking ? "bg-cyan-400 text-[#020a14] border-cyan-400" : "bg-transparent border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10"}`}>
            {parkingLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <SquareParking className="w-3 h-3" />}
            PARKING {parkingData ? `[${parkingData.count}]` : ""}
          </button>

          <button data-testid="mobility-btn" onClick={toggleMobility}
            className={`flex items-center gap-1.5 px-3 py-1 text-[11px] font-mono tracking-wide border transition-colors ${showMobility ? "bg-cyan-400 text-[#020a14] border-cyan-400" : "bg-transparent border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10"}`}>
            <Bike className="w-3 h-3" />
            BICIS {mobilityData ? `[${mobilityData.count}]` : ""}
          </button>

          <button data-testid="mobility-hub-btn" onClick={() => setShowMobilityHub((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-mono tracking-wide border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10">
            <Bike className="w-3 h-3" /> HUB MOVILIDAD
          </button>

          <button data-testid="heatmap-btn" onClick={toggleHeatmap}
            className={`flex items-center gap-1.5 px-3 py-1 text-[11px] font-mono tracking-wide border transition-colors ${showHeatmap ? "bg-cyan-400 text-[#020a14] border-cyan-400" : "bg-transparent border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10"}`}>
            <Flame className="w-3 h-3" />
            HEATMAP {showHeatmap ? "· ON" : ""}
          </button>

          <button data-testid="route-btn" onClick={() => setShowRoutePanel((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1 text-[11px] font-mono tracking-wide border transition-colors ${showRoutePanel ? "bg-cyan-400 text-[#020a14] border-cyan-400" : "bg-transparent border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10"}`}>
            <Route className="w-3 h-3" />
            ROUTE
          </button>

          <div className="relative">
            <button data-testid="export-btn" onClick={() => setExportOpen((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1 text-[11px] font-mono tracking-wide border transition-colors ${exportOpen ? "bg-cyan-400 text-[#020a14] border-cyan-400" : "bg-transparent border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10"}`}>
              <Download className="w-3 h-3" />
              EXPORT
            </button>
            {exportOpen && (
              <div className="absolute top-full mt-1 left-0 panel-solid brackets z-[60] w-[160px]">
                <button data-testid="export-geojson" onClick={exportGeoJSON}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 hover:bg-cyan-500/15 font-mono text-[10px] tracking-wider text-cyan-100">
                  <FileJson className="w-3 h-3 text-cyan-400" /> GEOJSON
                </button>
                <button data-testid="export-pdf" onClick={exportPDF}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 hover:bg-cyan-500/15 font-mono text-[10px] tracking-wider text-cyan-100 border-t border-cyan-500/15">
                  <FileText className="w-3 h-3 text-cyan-400" /> PDF REPORT
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 border border-cyan-500/30">
            <Layers className="w-3 h-3 text-cyan-400" />
            <select
              data-testid="filter-kind"
              value={filterKind}
              onChange={(e) => setFilterKind(e.target.value)}
              className="bg-transparent outline-none text-[11px] font-mono tracking-wide text-cyan-100 cursor-pointer">
              <option value="all" className="bg-[#020a14]">ALL LAYERS</option>
              <option value="accidente" className="bg-[#020a14]">ACCIDENTS</option>
              <option value="obras" className="bg-[#020a14]">WORKS</option>
              <option value="congestion" className="bg-[#020a14]">CONGESTION</option>
              <option value="peligro" className="bg-[#020a14]">HAZARDS</option>
              <option value="meteo" className="bg-[#020a14]">METEO</option>
              <option value="incidencia" className="bg-[#020a14]">OTHER</option>
            </select>
          </div>

          {measureMode && cursorMeasure && (
            <div className="font-mono text-[10px] tracking-wide text-cyan-300 px-3 py-1 bg-cyan-500/15 border border-cyan-500/50">
              ▸ SEG {Math.round(cursorMeasure.segment)}m · TOTAL {(cursorMeasure.total / 1000).toFixed(3)}km
            </div>
          )}
          {!measureMode && measureDistance > 0 && (
            <div className="font-mono text-[10px] tracking-wide text-cyan-300 px-3 py-1 bg-cyan-500/15 border border-cyan-500/50">
              ▸ MEASURED {Math.round(measureDistance)}m · {(measureDistance / 1000).toFixed(3)}km
            </div>
          )}

          <AzureToolbar
            showFlow={showAzureFlow} onToggleFlow={() => { setShowAzureFlow((v) => !v); addLog(`[AZURE] Traffic flow ${!showAzureFlow ? "engaged" : "disabled"}`, "info"); }}
            showAzureIncidents={showAzureIncidents} onToggleAzureIncidents={() => { setShowAzureIncidents((v) => !v); addLog(`[AZURE] Incident tiles ${!showAzureIncidents ? "engaged" : "disabled"}`, "info"); }}
            showWeatherRadar={showAzureWeather} onToggleWeatherRadar={() => { setShowAzureWeather((v) => !v); addLog(`[AZURE] Weather radar ${!showAzureWeather ? "engaged" : "disabled"}`, "info"); }}
            showSatellite={showAzureSat} onToggleSatellite={() => { setShowAzureSat((v) => !v); addLog(`[AZURE] MS satellite ${!showAzureSat ? "engaged" : "disabled"}`, "info"); }}
            onOpenEV={() => { setShowEVPanel((v) => !v); addLog(`[AZURE] EV stations panel ${!showEVPanel ? "open" : "closed"}`, "info"); }}
          />
        </div>
      </header>

      {/* ===== ROUTE OPTIMIZER PANEL ===== */}
      {showRoutePanel && (
        <RoutePanel
          routeFrom={routeFrom} setRouteFrom={setRouteFrom}
          routeTo={routeTo} setRouteTo={setRouteTo}
          routeMode={routeMode} setRouteMode={setRouteMode}
          routeResult={routeResult}
          routeLoading={routeLoading}
          onRun={runRoute}
          onClear={() => { clearRoute(); setRouteFrom(""); setRouteTo(""); }}
          onClose={() => setShowRoutePanel(false)}
        />
      )}

      {/* ===== EV CHARGING STATIONS ===== */}
      {showEVPanel && (
        <EVPanel
          lat={mapCenter.lat} lon={mapCenter.lng}
          onClose={() => setShowEVPanel(false)}
          onPick={(s) => {
            mapRef.current?.flyTo({ center: [s.lon, s.lat], zoom: 16, duration: 1000 });
            addLog(`[EV  ] Locked on ${s.name}`, "ok");
          }}
        />
      )}

      {/* ===== MOBILITY HUB ===== */}
      {showMobilityHub && (
        <MobilityHub
          lat={mapCenter.lat} lon={mapCenter.lng}
          toLat={routeResult?.to?.lat || null}
          toLon={routeResult?.to?.lon || null}
          onClose={() => setShowMobilityHub(false)}
          onPickStation={(s) => {
            mapRef.current?.flyTo({ center: [s.lon, s.lat], zoom: 16, duration: 1000 });
            addLog(`[MOB ] ${s.bikes} bikes @ ${s.name}`, "ok");
          }}
        />
      )}

      {/* ===== FOCUS button (floating bottom-right when sidebars hidden) ===== */}
      <button
        data-testid="focus-toggle"
        onClick={() => { setFocusMode((v) => !v); addLog(`[VIEW] Focus mode ${!focusMode ? "engaged · sala de control" : "disabled"}`, "info"); }}
        className="absolute top-[160px] right-3 z-[58] p-2 bg-cyan-500/15 border border-cyan-500/40 hover:bg-cyan-500/30 backdrop-blur-md"
        title={focusMode ? "Salir del modo presentación" : "Modo presentación / sala de control"}
      >
        {focusMode ? <Minimize2 className="w-4 h-4 text-cyan-200" /> : <Maximize2 className="w-4 h-4 text-cyan-200" />}
      </button>

      {/* ===== Focus mode floating KPIs ===== */}
      {focusMode && eventsData && (
        <div className="absolute top-[160px] left-3 z-[58] panel-solid brackets px-4 py-3 anim-fade-up" data-testid="focus-kpi">
          <div className="font-mono text-[9px] tracking-[0.22em] text-cyan-500/80 mb-2">SECTOR {(cities.find((c) => c.id === city)?.name || city).toUpperCase()} · LIVE</div>
          <div className="flex gap-6">
            <div>
              <div className="font-mono text-[8px] tracking-[0.22em] text-cyan-500/80">SITREC</div>
              <div className="font-mono text-3xl text-cyan-100 tabular-nums">{pad(eventsData.count)}</div>
            </div>
            <div>
              <div className="font-mono text-[8px] tracking-[0.22em] text-cyan-500/80">RIESGO</div>
              <div className={`font-mono text-3xl tabular-nums ${riskColor(eventsData.risk)}`}>{eventsData.risk}</div>
            </div>
            <div>
              <div className="font-mono text-[8px] tracking-[0.22em] text-cyan-500/80">CRÍT</div>
              <div className="font-mono text-3xl text-red-400 tabular-nums">{pad(eventsData.severity?.critical || 0, 3)}</div>
            </div>
          </div>
        </div>
      )}

      {/* ===== LEFT PANEL ===== */}
      <aside
        className={`absolute left-3 top-[150px] bottom-[200px] w-[340px] z-40 panel brackets flex-col anim-fade-up ${focusMode ? "hidden" : "hidden lg:flex"}`}
        data-testid="left-panel"
      >
        <div className="section-head"><span>SUBSYSTEM ANALYSIS · ALPHA V.2</span><span className="text-cyan-300/60">{pad(kpi.count)}</span></div>

        {/* KPI grid (Atlantis style: numeric heavy) */}
        <div className="grid grid-cols-3 border-b border-cyan-500/15" data-testid="kpi-grid">
          <KPI label="SITREC" value={pad(kpi.count)} accent="text-cyan-100" />
          <KPI label="RISK" value={kpi.risk} accent={riskColor(kpi.risk)} />
          <KPI label="LAYER" value={STYLES[mapStyle].label.toUpperCase()} accent="text-cyan-200" small />
          <KPI label="CRIT" value={pad(kpi.critical, 3)} accent="text-red-400" small />
          <KPI label="WARN" value={pad(kpi.warning, 3)} accent="text-amber-400" small />
          <KPI label="INFO" value={pad(kpi.info, 3)} accent="text-cyan-200" small last />
        </div>

        {/* Distribution */}
        <div className="px-3 py-2.5 border-b border-cyan-500/15">
          <div className="font-mono text-[9px] tracking-[0.22em] text-cyan-500/80 mb-2">EVENT MATRIX · DISTRIBUTION</div>
          <div className="space-y-1.5">
            {kinds.length === 0 && <div className="text-[10px] text-cyan-700 font-mono">[ AWAITING DATAFEED ]</div>}
            {kinds.map(([k, n]) => {
              const Icon = KIND_ICON[k] || Radio;
              return (
                <div key={k} className="flex items-center gap-2 text-[11px]">
                  <Icon className="w-3 h-3" style={{ color: `var(--${k}, #67e8f9)` }} />
                  <span className="font-mono tracking-wide text-cyan-200 w-20 uppercase">{KIND_LABEL[k] || k}</span>
                  <div className="flex-1 h-1.5 bg-cyan-900/40 overflow-hidden border border-cyan-500/15">
                    <div className="h-full" style={{ width: `${Math.min(100, (n / (eventsData?.count || 1)) * 100)}%`, background: `var(--${k}, #67e8f9)` }} />
                  </div>
                  <span className="font-mono text-[10px] text-cyan-100 tabular-nums w-7 text-right">{pad(n, 3)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Event Queue */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="section-head"><span>SITUATION RECORD QUEUE</span><span className="text-cyan-300/60">{pad(filteredFeatures.length)}</span></div>
          <div className="flex-1 overflow-y-auto" data-testid="event-queue">
            {loading && (
              <div className="flex items-center justify-center py-8 text-cyan-500/70 text-[11px] gap-2 font-mono">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> ESTABLISHING DGT LINK…
              </div>
            )}
            {!loading && filteredFeatures.length === 0 && (
              <div className="px-3 py-6 text-[11px] text-cyan-700 font-mono">[ NO RECORDS IN SECTOR ]</div>
            )}
            {filteredFeatures.slice(0, 200).map((f, idx) => (
              <EventRow key={f.id} f={f} idx={idx} active={selected?.id === f.id} onClick={() => {
                setSelected(f);
                addLog(`[SEL ] Target acquired ${f.id}`, "info");
                mapRef.current?.flyTo({ center: [f.lon, f.lat], zoom: 14, duration: 800 });
              }} />
            ))}
          </div>
        </div>
      </aside>

      {/* ===== RIGHT PANEL ===== */}
      <aside
        className={`absolute right-3 top-[150px] bottom-[200px] w-[340px] z-40 panel brackets flex-col anim-fade-up ${focusMode ? "hidden" : "hidden lg:flex"}`}
        data-testid="right-panel"
      >
        <div className="section-head"><span>{selected ? "ANÁLISIS DEL OBJETIVO" : "OPERATIVA EN VIVO"}</span><span className="text-cyan-300/60">▣</span></div>

        <div className="flex-1 overflow-y-auto">
          {!selected && (
            <>
              {/* Live Azure weather + alerts (powered by Azure Maps) */}
              <WeatherChip lat={mapCenter.lat} lon={mapCenter.lng} />

              {/* Chevron diagnostics like atlantis */}
              <div className="px-3 py-3 border-b border-cyan-500/15">
                <div className="font-mono text-[9px] tracking-[0.22em] text-cyan-500/80 mb-2">CHEVRON ANALYSIS</div>
                <div className="grid grid-cols-9 gap-1">
                  {Array.from({ length: 36 }).map((_, i) => {
                    const active = (i + (eventsData?.count || 0)) % 3 !== 0;
                    return (
                      <div key={`chev-cell-${i}`}
                           className="aspect-square border"
                           style={{
                             background: active ? "rgba(34,211,238,0.5)" : "rgba(34,211,238,0.08)",
                             borderColor: active ? "var(--cyan)" : "rgba(34,211,238,0.15)",
                             animation: active ? `chevron-flicker ${1 + (i % 5) * 0.3}s infinite ease-in-out` : "none",
                           }} />
                    );
                  })}
                </div>
              </div>

              {/* Subroutines list */}
              <div className="px-3 py-3 border-b border-cyan-500/15">
                <div className="font-mono text-[9px] tracking-[0.22em] text-cyan-500/80 mb-2">PRIMARY GTF SUBROUTINES</div>
                <div className="space-y-0.5">
                  {SUBROUTINES.map((s) => (
                    <div key={s[0]} className="flex items-center justify-between font-mono text-[10px] tracking-wider atlantis-row px-1 py-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-cyan-700">{s[0]}</span>
                        <span className="text-cyan-200">{s[1]}</span>
                      </div>
                      <span className={`text-[9px] tracking-wider ${s[2] === "ACTIVE" ? "text-emerald-400" : s[2] === "STANDBY" ? "text-cyan-500" : "text-zinc-600"}`}>
                        {s[2] === "ACTIVE" ? "● ACTIVE" : s[2] === "STANDBY" ? "○ STANDBY" : "× OFFLINE"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Source health */}
              <div className="px-3 py-3">
                <div className="font-mono text-[9px] tracking-[0.22em] text-cyan-500/80 mb-2">DATA FEED STATUS</div>
                <SourceBadge name="DGT 3.0 · DATEX2 v36" status={healthData?.sources?.["DGT 3.0"]} />
                <SourceBadge name="SCT · Catalunya GML" status={healthData?.sources?.SCT} />
                <SourceBadge name="MADRID · Open KML" status={healthData?.sources?.Madrid} />
                <SourceBadge name="OSM · Overpass API" status={healthData?.sources?.OSM} />
              </div>
            </>
          )}
          {selected && <EventDetail f={selected} onClose={() => setSelected(null)} />}
        </div>
      </aside>

      {/* ===== BOTTOM TABULAR PANEL ===== */}
      {!focusMode && (
        <div className="hidden md:block">
          <BottomDock
            logs={logs}
            features={filteredFeatures}
            onPickFeature={(f) => {
              setSelected(f);
              mapRef.current?.flyTo({ center: [f.lon, f.lat], zoom: 14 });
            }}
            mapCenter={mapCenter}
            zoom={zoom} pitch={pitch} bearing={bearing}
            mapStyle={mapStyle} lastUpdate={lastUpdate}
          />
        </div>
      )}

      {/* ===== STATUS BAR ===== */}
      <footer className="absolute bottom-0 left-0 right-0 z-50 panel-solid border-x-0 border-b-0" data-testid="status-bar">
        <div className="flex items-center justify-between px-5 py-1.5 text-[10px] font-mono tracking-wider">
          <div className="flex items-center gap-5">
            <StatusPill name="DGT 3.0" status={healthData?.sources?.["DGT 3.0"]} />
            <StatusPill name="SCT" status={healthData?.sources?.SCT} />
            <StatusPill name="MADRID" status={healthData?.sources?.Madrid} />
            <StatusPill name="OSM" status="OK" />
            <div className="flex items-center gap-1.5">
              <div className="live-dot" />
              <span className="text-cyan-300">REAL-TIME</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-cyan-400/70 tabular-nums">
            <span>SECTOR <span className="text-cyan-200">{(cities.find((c) => c.id === city)?.name || city).toUpperCase()}</span></span>
            <span>RANGE {eventsData?.radius_km || 150}KM</span>
            <span>{mapCenter.lat.toFixed(4)}, {mapCenter.lng.toFixed(4)}</span>
            <span className="text-cyan-300">{fmtTime(clock)} UTC</span>
            <span className="text-cyan-300">MOMENTUM · ROAD · COMMAND · v2.0</span>
          </div>
        </div>
      </footer>

      {/* Loading overlay */}
      {loading && !eventsData && (
        <div className="absolute inset-0 z-[60] bg-[#020a14]/85 backdrop-blur-md flex flex-col items-center justify-center pointer-events-none">
          <div className="relative w-32 h-32">
            <div className="radar-sweep" style={{ borderRadius: "50%" }} />
            <div className="absolute inset-0 border border-cyan-500/40 rounded-full" />
            <div className="absolute inset-3 border border-cyan-500/30 rounded-full" />
            <div className="absolute inset-6 border border-cyan-500/20 rounded-full" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Hexagon className="w-7 h-7 text-cyan-400 animate-pulse" />
            </div>
          </div>
          <div className="mt-6 font-mono text-[11px] tracking-[0.4em] text-cyan-300">CONECTANDO · DGT 3.0 · DATEX2</div>
          <div className="mt-2 font-mono text-[10px] tracking-[0.3em] text-cyan-600">EJECUTANDO DIAGNÓSTICO · ALPHA V.2</div>
        </div>
      )}
    </div>
  );
}
