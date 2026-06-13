import React, { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import { STYLES, getFreemapsStyle } from "@/lib/mapStyles";
import debug from "@/lib/debug";

const MapContainer = ({
  style = "normal",
  onReady = null,
  onMapChange = null,
  className = "",
}) => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [mapState, setMapState] = useState({
    center: { lat: 40.41678, lng: -3.70379 },
    zoom: 11,
    bearing: 0,
    pitch: 0,
  });

  // Initialize map
  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    debug("Initializing MapLibre GL");

    const freemapsKey = process.env.REACT_APP_MAPTILER_KEY;
    const styleDef = freemapsKey
      ? getFreemapsStyle(freemapsKey)
      : STYLES[style]?.style || STYLES.normal.style;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: styleDef,
      center: [mapState.center.lng, mapState.center.lat],
      zoom: mapState.zoom,
      pitch: mapState.pitch,
      bearing: mapState.bearing,
      attributionControl: { compact: true },
      cooperativeGestures: true,
    });

    mapRef.current = map;

    map.addControl(
      new maplibregl.NavigationControl({ visualizePitch: true }),
      "bottom-right"
    );
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

    const onMapLoad = () => {
      debug("Map loaded successfully");
      setReady(true);
      if (onReady) onReady(map);
    };

    if (map.isStyleLoaded()) {
      onMapLoad();
    } else {
      map.once("load", onMapLoad);
    }

    const onMove = () => {
      const center = map.getCenter();
      const newState = {
        center: { lat: center.lat, lng: center.lng },
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
      };
      setMapState(newState);
      if (onMapChange) onMapChange(newState);
    };

    map.on("move", onMove);
    map.on("zoom", onMove);
    map.on("rotate", onMove);
    map.on("pitch", onMove);

    return () => {
      map.off("move", onMove);
      map.off("zoom", onMove);
      map.off("rotate", onMove);
      map.off("pitch", onMove);
      map.remove();
      mapRef.current = null;
    };
  }, [onReady, onMapChange]);

  // Handle style changes
  useEffect(() => {
    if (!mapRef.current || !mapRef.current.isStyleLoaded()) return;

    debug(`Switching map style to: ${style}`);

    const freemapsKey = process.env.REACT_APP_MAPTILER_KEY;
    const styleToApply = freemapsKey
      ? getFreemapsStyle(freemapsKey)
      : STYLES[style]?.style || STYLES.normal.style;

    mapRef.current.setStyle(styleToApply);

    mapRef.current.once("styledata", () => {
      if (style === "threed") {
        try {
          mapRef.current.setTerrain({
            source: "terrain-rgb",
            exaggeration: 1.4,
          });
          mapRef.current.easeTo({
            pitch: 60,
            bearing: -17,
            duration: 1200,
          });
          debug("3D terrain enabled");
        } catch (e) {
          debug("3D terrain setup failed:", e);
        }
      } else {
        try {
          mapRef.current.setTerrain(null);
        } catch (e) {
          debug("Terrain reset failed:", e);
        }
        mapRef.current.easeTo({
          pitch: 0,
          bearing: 0,
          duration: 800,
        });
      }
    });
  }, [style]);

  return (
    <div
      ref={mapContainerRef}
      className={`absolute inset-0 w-full h-full ${className}`}
      data-testid="map-container"
    />
  );
};

export default MapContainer;
