import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { STYLES } from "@/lib/mapStyles";

const MapContainer = ({ style = "normal", onReady = null }) => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (mapRef.current) return; // already initialized

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: STYLES[style].style,
      center: [-3.70379, 40.41678],
      zoom: 11,
      pitch: 0,
      bearing: 0,
      attributionControl: { compact: true },
    });

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

    map.on("load", () => {
      setReady(true);
      if (onReady) onReady(map);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [onReady]);

  // Handle style changes
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setStyle(STYLES[style].style);
  }, [style]);

  return (
    <div
      ref={mapContainerRef}
      className="absolute inset-0 w-full h-full"
      data-testid="map-container"
    />
  );
};

export default MapContainer;