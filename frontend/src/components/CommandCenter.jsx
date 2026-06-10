import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import {
  Radio, AlertTriangle, Construction, OctagonAlert, TrendingUp, Layers, Ruler,
  SquareParking, Search, RotateCw, Mountain, Satellite, Map as MapIcon,
  Activity, Crosshair, ChevronRight, Power, CloudRain, Loader2, Eye, EyeOff, X,
} from "lucide-react";

import { STYLES } from "@/lib/mapStyles";
import { fetchEvents, fetchParking, fetchCities, fetchHealth, geocode } from "@/lib/api";

const KIND_ICON = {
  obras: Construction,
  accidente: AlertTriangle,
  congestion: TrendingUp,
  peligro: OctagonAlert,
  meteo: CloudRain,
  incidencia: Radio,
};

const KIND_GLYPH = {
  obras: "!",
  accidente: "X",
  congestion: "≋",
  peligro: "▲",
  meteo: "~",
  incidencia: "i",
};

const KIND_LABEL = {
  obras: "Obras",
  accidente: "Accidente",
  congestion: "Congestión",
  peligro: "Peligro",
  meteo: "Meteo",
  incidencia: "Incidencia",
};

const SEV_COLOR = {
  critical: "#ef4444",
  warning: "#f59e0b",
  info: "#3b82f6",
};

function formatTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch { return "--:--"; }
}

export default function CommandCenter() {
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const markersRef = useRef([]);
  const parkingMarkersRef = useRef([]);
  const measurePointsRef = useRef([]);
  const measureMarkersRef = useRef([]);
  const measureLineSourceIdRef = useRef("measure-line");
  const hoverPopupRef = useRef(null);
  const cursorMeasureRef = useRef(null);

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
  const [searchQuery, setSearchQuery] = useState("");
  const [filterKind, setFilterKind] = useState("all");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [pitch, setPitch] = useState(0);
  const [lastUpdate, setLastUpdate] = useState(null);

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

    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- change style ----
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
        } catch (e) { /* terrain unavailable in this style */ }
      } else {
        try { map.setTerrain(null); } catch (e) { /* no terrain to remove */ }
        map.easeTo({ pitch: 0, bearing: 0, duration: 800 });
      }
      // re-render markers after style change
      renderEventMarkers(eventsData);
      renderParkingMarkers(parkingData);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapStyle]);

  // ---- load cities ----
  useEffect(() => {
    fetchCities().then(setCities).catch(() => {});
    fetchHealth().then(setHealthData).catch(() => {});
    const t = setInterval(() => fetchHealth().then(setHealthData).catch(() => {}), 60000);
    return () => clearInterval(t);
  }, []);

  // ---- load events when city changes + auto refresh ----
  const loadEvents = useCallback(async (cityId) => {
    setLoading(true);
    try {
      const data = await fetchEvents(cityId);
      setEventsData(data);
      setLastUpdate(new Date());
      // center map
      if (mapRef.current && data.center) {
        mapRef.current.easeTo({
          center: [data.center.lon, data.center.lat],
          zoom: 11.5,
          duration: 1000,
        });
      }
    } catch (e) {
      console.error("Events load error", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEvents(city); }, [city, loadEvents]);

  // auto refresh every 90s
  useEffect(() => {
    const t = setInterval(() => loadEvents(city), 90_000);
    return () => clearInterval(t);
  }, [city, loadEvents]);

  // ---- render event markers ----
  const filteredFeatures = useMemo(() => {
    if (!eventsData) return [];
    if (filterKind === "all") return eventsData.features;
    return eventsData.features.filter((f) => f.kind === filterKind);
  }, [eventsData, filterKind]);

  const renderEventMarkers = useCallback((data) => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    if (!data || !data.features) return;
    const feats = filterKind === "all" ? data.features : data.features.filter((f) => f.kind === filterKind);
    feats.forEach((f) => {
      const el = document.createElement("div");
      el.className = `mrc-marker kind-${f.kind}`;
      el.setAttribute("data-testid", `event-marker-${f.id}`);
      el.innerHTML = `<span>${KIND_GLYPH[f.kind] || "?"}</span>`;
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        setSelected(f);
        map.easeTo({ center: [f.lon, f.lat], zoom: Math.max(map.getZoom(), 13), duration: 600 });
      });
      el.addEventListener("mouseenter", () => {
        if (hoverPopupRef.current) hoverPopupRef.current.remove();
        hoverPopupRef.current = new maplibregl.Popup({ closeButton: false, className: "mrc-popup", offset: 18 })
          .setLngLat([f.lon, f.lat])
          .setHTML(`<div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#06b6d4;text-transform:uppercase;letter-spacing:0.08em;">${f.source}</div>
                    <div style="font-weight:600;font-size:13px;margin-top:2px">${KIND_LABEL[f.kind] || "Incidencia"}</div>
                    <div style="color:#a1a1aa;font-size:12px;margin-top:2px">${f.road || ""}</div>`)
          .addTo(map);
      });
      el.addEventListener("mouseleave", () => {
        if (hoverPopupRef.current) { hoverPopupRef.current.remove(); hoverPopupRef.current = null; }
      });
      const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([f.lon, f.lat])
        .addTo(map);
      markersRef.current.push(marker);
    });
  }, [filterKind]);

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
      el.innerHTML = `<span>P</span>`;
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        setSelected({
          id: p.id, kind: "parking", title: p.name || "Parking",
          description: `Plazas estimadas libres: ${p.available_estimate}${p.capacity ? ` / ${p.capacity}` : ""} · ${p.fee !== "unknown" ? `Tarifa: ${p.fee}` : "Tarifa no especificada"}`,
          source: "OpenStreetMap", road: p.operator || "OSM",
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
    try {
      const data = await fetchParking(c.lat, c.lng, 1500);
      setParkingData(data);
    } catch (e) { console.error(e); }
    finally { setParkingLoading(false); }
  }, []);

  const toggleParking = useCallback(() => {
    if (showParking) {
      setShowParking(false);
      setParkingData(null);
    } else {
      loadParkingHere();
    }
  }, [showParking, loadParkingHere]);

  // ---- measure tool ----
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
        paint: { "line-color": "#06b6d4", "line-width": 3, "line-dasharray": [2, 1] },
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
      el.style.cssText = "width:10px;height:10px;border-radius:50%;background:#06b6d4;border:2px solid #0a0a0a;box-shadow:0 0 8px rgba(6,182,212,0.6)";
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

    if (measureMode) {
      map.getCanvas().style.cursor = "crosshair";
    } else {
      map.getCanvas().style.cursor = "";
    }
    return () => {
      map.off("click", onClick);
      map.off("mousemove", onMouseMove);
      map.off("mouseout", onMouseOut);
    };
  }, [measureMode, updateMeasureLine]);

  const toggleMeasure = () => {
    if (measureMode) {
      clearMeasure();
      setMeasureMode(false);
    } else {
      setMeasureMode(true);
    }
  };

  // ---- search ----
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      const r = await geocode(searchQuery);
      if (mapRef.current && r) {
        mapRef.current.flyTo({ center: [r.lon, r.lat], zoom: 14, duration: 1200 });
      }
    } catch (e) { console.error(e); }
  };

  // ---- locate ----
  const locateMe = () => {
    if (!navigator.geolocation || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      mapRef.current.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 15, duration: 1200 });
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
    <div className="relative w-screen h-screen overflow-hidden bg-[#0a0a0a]" data-testid="command-center">
      {/* MAP */}
      <div ref={mapContainerRef} className="absolute inset-0" data-testid="map-container" />

      {/* TOP HEADER */}
      <header className="absolute top-0 left-0 right-0 z-50 panel border-x-0 border-t-0" data-testid="top-header">
        <div className="flex items-center gap-4 px-5 py-3">
          {/* Brand */}
          <div className="flex items-center gap-3 pr-5 border-r border-white/10">
            <div className="relative flex items-center justify-center w-9 h-9 rounded-md bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 border border-cyan-500/40">
              <Radio className="w-4 h-4 text-cyan-400" />
              <div className="absolute -top-1 -right-1 live-dot" />
            </div>
            <div>
              <div className="font-display font-semibold text-[15px] leading-none tracking-tight">MOMENTUM</div>
              <div className="font-mono text-[10px] tracking-[0.18em] text-zinc-400 mt-1">ROAD · COMMAND · CENTER</div>
            </div>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 flex-1 max-w-xl">
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-white/5 border border-white/10 flex-1 hover:border-white/20 transition-colors">
              <Search className="w-4 h-4 text-zinc-400 flex-shrink-0" />
              <input
                data-testid="search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Buscar dirección, carretera, punto operativo…"
                className="bg-transparent outline-none text-sm flex-1 placeholder:text-zinc-500"
              />
              <button data-testid="search-go-btn" onClick={handleSearch}
                className="font-mono text-[11px] text-cyan-300 hover:text-cyan-200 px-2 py-0.5 rounded border border-cyan-500/30 bg-cyan-500/10">
                IR
              </button>
            </div>
            <button data-testid="locate-btn" onClick={locateMe} title="Centrar en mi posición"
              className="p-2 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-colors">
              <Crosshair className="w-4 h-4 text-zinc-300" />
            </button>
          </div>

          {/* City selector */}
          <div className="flex items-center gap-2">
            <select
              data-testid="city-select"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="bg-white/5 border border-white/10 hover:border-white/20 rounded-md px-3 py-2 text-sm font-medium outline-none cursor-pointer">
              {cities.map((c) => (
                <option key={c.id} value={c.id} className="bg-zinc-900">{c.name}</option>
              ))}
            </select>
            <button data-testid="refresh-btn" onClick={() => loadEvents(city)}
              className="flex items-center gap-2 px-3 py-2 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-sm transition-colors">
              <RotateCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden md:inline">Actualizar</span>
            </button>
          </div>

          {/* Live + clock */}
          <div className="flex items-center gap-3 pl-4 border-l border-white/10">
            <div className="flex items-center gap-2">
              <div className="live-dot" />
              <div className="font-mono text-[11px] tracking-[0.15em] text-cyan-300">LIVE</div>
            </div>
            <div className="font-mono text-xs text-zinc-400" data-testid="last-update">
              {lastUpdate ? formatTime(lastUpdate.toISOString()) : "--:--:--"}
            </div>
          </div>
        </div>

        {/* Toolbar row */}
        <div className="flex items-center gap-2 px-5 pb-3 flex-wrap">
          <div className="flex items-center gap-0 bg-white/5 border border-white/10 rounded-md p-1">
            {Object.values(STYLES).map((s) => (
              <button key={s.id}
                data-testid={`map-style-${s.id}`}
                onClick={() => setMapStyle(s.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${mapStyle === s.id ? "bg-cyan-500/20 text-cyan-300" : "text-zinc-400 hover:text-zinc-200"}`}>
                {s.id === "normal" && <MapIcon className="w-3.5 h-3.5" />}
                {s.id === "satellite" && <Satellite className="w-3.5 h-3.5" />}
                {s.id === "threed" && <Mountain className="w-3.5 h-3.5" />}
                {s.label}
              </button>
            ))}
          </div>

          <button
            data-testid="measure-btn"
            onClick={toggleMeasure}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${measureMode ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40" : "bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10"}`}>
            <Ruler className="w-3.5 h-3.5" />
            {measureMode ? "Medir: ON" : "Medir calle"}
          </button>

          {measureMode && (
            <button data-testid="clear-measure-btn" onClick={clearMeasure}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-white/5 border border-white/10 hover:bg-white/10">
              <X className="w-3.5 h-3.5" /> Limpiar
            </button>
          )}

          <button data-testid="parking-btn" onClick={toggleParking}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${showParking ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40" : "bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10"}`}>
            {parkingLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SquareParking className="w-3.5 h-3.5" />}
            Parking cercano {parkingData ? `(${parkingData.count})` : ""}
          </button>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-xs">
            <Layers className="w-3.5 h-3.5 text-zinc-400" />
            <select
              data-testid="filter-kind"
              value={filterKind}
              onChange={(e) => setFilterKind(e.target.value)}
              className="bg-transparent outline-none text-xs cursor-pointer">
              <option value="all" className="bg-zinc-900">Todas las capas</option>
              <option value="accidente" className="bg-zinc-900">Accidentes</option>
              <option value="obras" className="bg-zinc-900">Obras</option>
              <option value="congestion" className="bg-zinc-900">Congestión</option>
              <option value="peligro" className="bg-zinc-900">Peligros</option>
              <option value="meteo" className="bg-zinc-900">Meteo</option>
              <option value="incidencia" className="bg-zinc-900">Otras</option>
            </select>
          </div>

          {measureMode && cursorMeasure && (
            <div className="font-mono text-xs text-cyan-300 px-3 py-1.5 rounded-md bg-cyan-500/10 border border-cyan-500/30">
              ▸ Segmento: {Math.round(cursorMeasure.segment)} m · Total: {(cursorMeasure.total / 1000).toFixed(3)} km
            </div>
          )}

          {!measureMode && measureDistance > 0 && (
            <div className="font-mono text-xs text-cyan-300 px-3 py-1.5 rounded-md bg-cyan-500/10 border border-cyan-500/30">
              ▸ {Math.round(measureDistance)} m · {(measureDistance / 1000).toFixed(3)} km
            </div>
          )}
        </div>
      </header>

      {/* LEFT PANEL - KPIs + Event Queue */}
      <aside
        className={`absolute left-4 top-[148px] bottom-[56px] w-[340px] z-40 panel rounded-lg overflow-hidden flex flex-col anim-fade-up transition-transform ${leftOpen ? "translate-x-0" : "-translate-x-[360px]"}`}
        data-testid="left-panel"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <div className="font-display font-semibold text-sm">PANEL TÁCTICO</div>
          </div>
          <button onClick={() => setLeftOpen(false)} className="text-zinc-500 hover:text-zinc-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 border-b border-white/10" data-testid="kpi-grid">
          <KPI label="Eventos" value={kpi.count} accent="text-white" />
          <KPI label="Riesgo" value={kpi.risk} accent={kpi.risk === "ALTO" ? "text-red-400" : kpi.risk === "MEDIO" ? "text-amber-400" : "text-emerald-400"} />
          <KPI label="Críticos" value={kpi.critical} accent="text-red-400" />
          <KPI label="Avisos" value={kpi.warning} accent="text-amber-400" />
          <KPI label="Ciudad" value={cities.find((c) => c.id === city)?.name || city.toUpperCase()} accent="text-cyan-300" small />
          <KPI label="Vista" value={STYLES[mapStyle].label} accent="text-cyan-300" small />
        </div>

        {/* Kinds breakdown */}
        <div className="px-4 py-3 border-b border-white/10">
          <div className="font-mono text-[10px] tracking-[0.15em] text-zinc-500 mb-2">DISTRIBUCIÓN POR TIPO</div>
          <div className="space-y-1.5">
            {kinds.length === 0 && <div className="text-xs text-zinc-500 font-mono">Sin datos…</div>}
            {kinds.map(([k, n]) => {
              const Icon = KIND_ICON[k] || Radio;
              return (
                <div key={k} className="flex items-center gap-2 text-xs">
                  <Icon className="w-3.5 h-3.5" style={{ color: `var(--${k}, #71717a)` }} />
                  <span className="capitalize text-zinc-300">{KIND_LABEL[k] || k}</span>
                  <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (n / (eventsData?.count || 1)) * 100)}%`, background: `var(--${k}, #71717a)` }} />
                  </div>
                  <span className="font-mono text-[11px] text-zinc-400 tabular-nums w-6 text-right">{n}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Event Queue */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
            <div className="font-mono text-[10px] tracking-[0.15em] text-zinc-500">COLA DE EVENTOS</div>
            <div className="font-mono text-[10px] text-cyan-300">{filteredFeatures.length}</div>
          </div>
          <div className="flex-1 overflow-y-auto" data-testid="event-queue">
            {loading && (
              <div className="flex items-center justify-center py-8 text-zinc-500 text-xs gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Conectando con DGT 3.0…
              </div>
            )}
            {!loading && filteredFeatures.length === 0 && (
              <div className="px-4 py-6 text-xs text-zinc-500">No hay incidencias en la región seleccionada.</div>
            )}
            {filteredFeatures.map((f) => (
              <EventRow key={f.id} f={f} active={selected?.id === f.id} onClick={() => {
                setSelected(f);
                mapRef.current?.flyTo({ center: [f.lon, f.lat], zoom: 14, duration: 800 });
              }} />
            ))}
          </div>
        </div>
      </aside>

      {!leftOpen && (
        <button onClick={() => setLeftOpen(true)}
          className="absolute left-4 top-[160px] z-40 panel rounded-lg p-2 hover:bg-white/5"
          data-testid="left-toggle">
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* RIGHT PANEL - Detail + Sources */}
      <aside
        className={`absolute right-4 top-[148px] bottom-[56px] w-[340px] z-40 panel rounded-lg overflow-hidden flex flex-col anim-fade-up transition-transform ${rightOpen ? "translate-x-0" : "translate-x-[360px]"}`}
        data-testid="right-panel"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-cyan-400" />
            <div className="font-display font-semibold text-sm">DETALLE OPERATIVO</div>
          </div>
          <button onClick={() => setRightOpen(false)} className="text-zinc-500 hover:text-zinc-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!selected && (
            <div className="px-4 py-6">
              <div className="text-xs text-zinc-500 leading-relaxed">
                Selecciona una incidencia en el mapa o en la cola para ver inteligencia detallada, fuente y acciones rápidas.
              </div>
              <div className="mt-6">
                <div className="font-mono text-[10px] tracking-[0.15em] text-zinc-500 mb-2">FUENTES CONECTADAS</div>
                <SourceBadge name="DGT 3.0 · DATEX2" status={healthData?.sources?.["DGT 3.0"]} />
                <SourceBadge name="SCT · Catalunya" status={healthData?.sources?.SCT} />
                <SourceBadge name="Madrid Abierto" status={healthData?.sources?.Madrid} />
                <SourceBadge name="OpenStreetMap" status={healthData?.sources?.OSM} />
              </div>
            </div>
          )}
          {selected && <EventDetail f={selected} onClose={() => setSelected(null)} />}
        </div>
      </aside>

      {!rightOpen && (
        <button onClick={() => setRightOpen(true)}
          className="absolute right-4 top-[160px] z-40 panel rounded-lg p-2 hover:bg-white/5"
          data-testid="right-toggle">
          <ChevronRight className="w-4 h-4 rotate-180" />
        </button>
      )}

      {/* BOTTOM STATUS BAR */}
      <footer className="absolute bottom-0 left-0 right-0 z-50 panel border-x-0 border-b-0" data-testid="status-bar">
        <div className="flex items-center justify-between px-5 py-2 text-xs">
          <div className="flex items-center gap-5">
            <StatusPill name="DGT 3.0" status={healthData?.sources?.["DGT 3.0"]} />
            <StatusPill name="SCT" status={healthData?.sources?.SCT} />
            <StatusPill name="Madrid" status={healthData?.sources?.Madrid} />
            <StatusPill name="OSM" status="OK" />
          </div>
          <div className="flex items-center gap-4 font-mono text-[11px] text-zinc-500">
            <span>PITCH {pitch}°</span>
            <span>MODE {mapStyle.toUpperCase()}</span>
            {eventsData?.center && (
              <span>{eventsData.center.lat.toFixed(4)}, {eventsData.center.lon.toFixed(4)}</span>
            )}
            <span className="text-cyan-300">v2.0 · Real-time</span>
          </div>
        </div>
      </footer>

      {/* Loading overlay */}
      {loading && !eventsData && (
        <div className="absolute inset-0 z-[60] bg-black/70 backdrop-blur-md flex flex-col items-center justify-center pointer-events-none">
          <div className="relative w-24 h-24">
            <div className="radar-sweep" style={{ borderRadius: "50%" }} />
            <div className="absolute inset-0 border border-cyan-500/40 rounded-full" />
            <div className="absolute inset-2 border border-cyan-500/30 rounded-full" />
            <div className="absolute inset-4 border border-cyan-500/20 rounded-full" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Radio className="w-6 h-6 text-cyan-400 animate-pulse" />
            </div>
          </div>
          <div className="mt-6 font-mono text-xs tracking-[0.2em] text-cyan-300">CONECTANDO · DGT 3.0</div>
        </div>
      )}
    </div>
  );
}

function KPI({ label, value, accent = "text-white", small = false }) {
  return (
    <div className="px-4 py-3 border-r border-b border-white/10 last:border-r-0">
      <div className="font-mono text-[9px] tracking-[0.18em] text-zinc-500 uppercase mb-1">{label}</div>
      <div className={`font-mono ${small ? "text-base" : "text-2xl"} font-semibold tabular-nums ${accent}`}>{value}</div>
    </div>
  );
}

function EventRow({ f, active, onClick }) {
  const Icon = KIND_ICON[f.kind] || Radio;
  const color = SEV_COLOR[f.severity] || "#71717a";
  return (
    <button
      data-testid={`event-row-${f.id}`}
      onClick={onClick}
      className={`w-full text-left flex items-start gap-2.5 px-4 py-2.5 border-b border-white/5 hover:bg-white/5 transition-colors ${active ? "bg-white/5" : ""}`}
      style={{ borderLeft: `2px solid ${color}` }}
    >
      <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium truncate">{KIND_LABEL[f.kind] || "Incidencia"}</span>
        </div>
        <div className="text-xs text-zinc-400 truncate">{f.road || f.title}</div>
        <div className="font-mono text-[10px] text-zinc-600 tracking-wide mt-1">{f.source}</div>
      </div>
    </button>
  );
}

function EventDetail({ f, onClose }) {
  const Icon = KIND_ICON[f.kind] || Radio;
  const color = SEV_COLOR[f.severity] || "#71717a";
  return (
    <div className="p-4 anim-fade-up" data-testid="event-detail">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-md flex items-center justify-center" style={{ background: `${color}20`, border: `1px solid ${color}40` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <div className="flex-1">
          <div className="font-mono text-[10px] tracking-[0.15em] text-zinc-500 uppercase">{f.source}</div>
          <div className="font-display font-semibold text-base mt-0.5">{KIND_LABEL[f.kind] || f.title}</div>
        </div>
      </div>

      <div className="space-y-3 text-sm">
        {f.road && (
          <Field label="Vía">{f.road}</Field>
        )}
        <Field label="Descripción">
          <span className="text-zinc-300 leading-relaxed">{f.description}</span>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Latitud" mono>{f.lat?.toFixed(5)}</Field>
          <Field label="Longitud" mono>{f.lon?.toFixed(5)}</Field>
        </div>
        <Field label="Severidad">
          <span className="px-2 py-0.5 rounded text-[11px] font-mono tracking-wide" style={{ background: `${color}20`, color, border: `1px solid ${color}50` }}>
            {(f.severity || "info").toUpperCase()}
          </span>
        </Field>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <a
          data-testid="event-gmaps"
          target="_blank" rel="noreferrer"
          href={`https://www.google.com/maps/dir/?api=1&destination=${f.lat},${f.lon}`}
          className="text-center px-3 py-2 rounded-md bg-white/5 border border-white/10 hover:bg-white/10 text-xs">
          Abrir en Maps
        </a>
        <button
          data-testid="event-close"
          onClick={onClose}
          className="px-3 py-2 rounded-md bg-white/5 border border-white/10 hover:bg-white/10 text-xs">
          Cerrar
        </button>
      </div>
    </div>
  );
}

function Field({ label, children, mono = false }) {
  return (
    <div>
      <div className="font-mono text-[10px] tracking-[0.15em] text-zinc-500 uppercase mb-1">{label}</div>
      <div className={mono ? "font-mono text-sm text-zinc-200" : "text-sm text-zinc-100"}>{children}</div>
    </div>
  );
}

function StatusPill({ name, status }) {
  const ok = status === "OK";
  return (
    <div className="flex items-center gap-2" data-testid={`status-${name.toLowerCase().replace(/\s/g, '-').replace('.','-')}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-emerald-400" : status === "DOWN" ? "bg-red-500" : "bg-zinc-600"}`} />
      <span className="font-mono text-[11px] text-zinc-400">{name}</span>
      <span className={`font-mono text-[10px] ${ok ? "text-emerald-400" : status === "DOWN" ? "text-red-400" : "text-zinc-500"}`}>
        {status || "—"}
      </span>
    </div>
  );
}

function SourceBadge({ name, status }) {
  const ok = status === "OK";
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
      <span className="text-xs text-zinc-300">{name}</span>
      <div className="flex items-center gap-1.5">
        <div className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-emerald-400" : status === "DOWN" ? "bg-red-500" : "bg-zinc-600"}`} />
        <span className={`font-mono text-[10px] ${ok ? "text-emerald-400" : status === "DOWN" ? "text-red-400" : "text-zinc-500"}`}>
          {status || "—"}
        </span>
      </div>
    </div>
  );
}
