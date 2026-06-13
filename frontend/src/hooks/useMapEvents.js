import { useEffect, useRef, useCallback } from "react";
import maplibregl from "maplibre-gl";

/**
 * Hook to render event markers on the map
 */
export const useEventMarkers = (map, eventsData, filterKind, onEventClick) => {
  const markersRef = useRef([]);

  const renderEventMarkers = useCallback(() => {
    if (!map || !map.isStyleLoaded()) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (!eventsData) return;

    const SRC = "events-src";
    const CIRC = "events-circle";
    const TXT = "events-text";

    const feats =
      filterKind === "all"
        ? eventsData.features
        : eventsData.features.filter((f) => f.kind === filterKind);

    const fc = {
      type: "FeatureCollection",
      features: feats.map((f) => ({
        type: "Feature",
        properties: {
          id: f.id,
          kind: f.kind,
          severity: f.severity,
          road: f.road,
          source: f.source,
          title: f.title,
          description: f.description,
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
          "circle-color": [
            "match",
            ["get", "kind"],
            "accidente",
            "#ef4444",
            "obras",
            "#fbbf24",
            "congestion",
            "#c084fc",
            "peligro",
            "#fb923c",
            "meteo",
            "#22d3ee",
            "incidencia",
            "#67e8f9",
            "#67e8f9",
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
          "text-field": [
            "match",
            ["get", "kind"],
            "accidente",
            "X",
            "obras",
            "!",
            "congestion",
            "≋",
            "peligro",
            "▲",
            "meteo",
            "~",
            "incidencia",
            "i",
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

      map.on("click", CIRC, (ev) => {
        const f = ev.features?.[0];
        if (!f) return;
        const props = f.properties;
        const [lon, lat] = f.geometry.coordinates;
        const evt = { ...props, lat, lon };
        if (onEventClick) onEventClick(evt);
      });

      map.on("mouseenter", CIRC, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", CIRC, () => {
        map.getCanvas().style.cursor = "";
      });
    }
  }, [map, eventsData, filterKind, onEventClick]);

  useEffect(() => {
    renderEventMarkers();
  }, [renderEventMarkers]);

  return { renderEventMarkers };
};

/**
 * Hook to handle distance measurement on the map
 */
export const useMeasureTool = (map, enabled) => {
  const measurePointsRef = useRef([]);
  const measureMarkersRef = useRef([]);
  const measureLineSourceIdRef = useRef("measure-line");

  const haversineMeters = (a, b) => {
    const R = 6371000;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLon = ((b.lng - a.lng) * Math.PI) / 180;
    const s =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((a.lat * Math.PI) / 180) *
        Math.cos((b.lat * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  };

  const updateMeasureLine = useCallback(() => {
    if (!map) return;
    const id = measureLineSourceIdRef.current;
    const coords = measurePointsRef.current.map((p) => [p.lng, p.lat]);
    const geo = {
      type: "Feature",
      geometry: { type: "LineString", coordinates: coords },
    };

    if (map.getSource(id)) {
      map.getSource(id).setData(geo);
    } else {
      map.addSource(id, { type: "geojson", data: geo });
      map.addLayer({
        id: id + "-line",
        type: "line",
        source: id,
        paint: { "line-color": "#22d3ee", "line-width": 3, "line-dasharray": [2, 1] },
      });
    }

    let total = 0;
    for (let i = 1; i < coords.length; i++) {
      total += haversineMeters(
        { lng: coords[i - 1][0], lat: coords[i - 1][1] },
        { lng: coords[i][0], lat: coords[i][1] }
      );
    }
    return total;
  }, [map]);

  const clearMeasure = useCallback(() => {
    if (!map) return;
    measurePointsRef.current = [];
    measureMarkersRef.current.forEach((m) => m.remove());
    measureMarkersRef.current = [];
    if (map.getLayer(measureLineSourceIdRef.current + "-line")) {
      map.removeLayer(measureLineSourceIdRef.current + "-line");
    }
    if (map.getSource(measureLineSourceIdRef.current)) {
      map.removeSource(measureLineSourceIdRef.current);
    }
  }, [map]);

  useEffect(() => {
    if (!map || !enabled) return;

    const onClick = (e) => {
      const pt = e.lngLat;
      measurePointsRef.current.push(pt);
      const el = document.createElement("div");
      el.style.cssText =
        "width:10px;height:10px;background:#22d3ee;border:2px solid #02101a;box-shadow:0 0 10px rgba(34,211,238,0.8)";
      const marker = new maplibregl.Marker({ element: el }).setLngLat(pt).addTo(map);
      measureMarkersRef.current.push(marker);
      updateMeasureLine();
    };

    map.on("click", onClick);
    map.getCanvas().style.cursor = "crosshair";

    return () => {
      map.off("click", onClick);
      map.getCanvas().style.cursor = "";
    };
  }, [map, enabled, updateMeasureLine]);

  return { clearMeasure, updateMeasureLine, measurePointsRef };
};
