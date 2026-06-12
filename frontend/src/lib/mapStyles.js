/**
 * MapLibre styles - free open providers, no API key required.
 * - normal:    OpenFreeMap "liberty" (vector, dark variant)
 * - satellite: ESRI World Imagery (raster, free)
 * - 3d:        Maptiler-compatible terrain via AWS Terrarium tiles, OFM base + sky + 3D buildings
 */

export const STYLE_NORMAL = {
  version: 8,
  name: "MRC Dark",
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    "carto-dark": {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap, © CARTO',
      maxzoom: 19,
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#0a0a0a" } },
    { id: "carto-dark", type: "raster", source: "carto-dark" },
  ],
};

export const STYLE_SATELLITE = {
  version: 8,
  name: "MRC Satellite",
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    "esri-world": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics",
      maxzoom: 19,
    },
    "esri-labels": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 19,
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#000" } },
    { id: "esri-world", type: "raster", source: "esri-world" },
    { id: "esri-labels", type: "raster", source: "esri-labels", paint: { "raster-opacity": 0.85 } },
  ],
};

// 3D: dark base + terrain (AWS) + sky
export const STYLE_3D = {
  version: 8,
  name: "MRC 3D",
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    "carto-dark": {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© OpenStreetMap, © CARTO",
    },
    "terrain-rgb": {
      type: "raster-dem",
      tiles: [
        "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      encoding: "terrarium",
      maxzoom: 15,
      attribution: "Terrain © Mapzen / AWS Open Data",
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#050505" } },
    { id: "carto-dark", type: "raster", source: "carto-dark" },
  ],
  terrain: { source: "terrain-rgb", exaggeration: 1.4 },
  sky: {
    "sky-color": "#0a0a0a",
    "horizon-color": "#1a1a2e",
    "fog-color": "#0a0a0a",
    "fog-ground-blend": 0.5,
  },
};

// Vector + 3D buildings via OpenFreeMap Liberty (free, no API key)
export const STYLE_VECTOR_3D = {
  version: 8,
  name: "MRC Vector 3D",
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {
    "openmaptiles": {
      type: "vector",
      url: "https://tiles.openfreemap.org/planet",
      attribution: "© OpenStreetMap · OpenFreeMap",
    },
    "terrain-rgb": {
      type: "raster-dem",
      tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
      tileSize: 256,
      encoding: "terrarium",
      maxzoom: 15,
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#020a14" } },
    { id: "water", type: "fill", source: "openmaptiles", "source-layer": "water",
      paint: { "fill-color": "#06141f", "fill-antialias": true } },
    { id: "landcover", type: "fill", source: "openmaptiles", "source-layer": "landcover",
      paint: { "fill-color": "#0a1f30", "fill-opacity": 0.45 } },
    { id: "park", type: "fill", source: "openmaptiles", "source-layer": "park",
      paint: { "fill-color": "#08372a", "fill-opacity": 0.5 } },
    // roads — high contrast white-ish
    { id: "road-minor", type: "line", source: "openmaptiles", "source-layer": "transportation",
      filter: ["in", "class", "minor", "service", "track"],
      paint: { "line-color": "#3a5b78", "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.5, 18, 3] } },
    { id: "road-secondary", type: "line", source: "openmaptiles", "source-layer": "transportation",
      filter: ["in", "class", "secondary", "tertiary"],
      paint: { "line-color": "#6fa3cf", "line-width": ["interpolate", ["linear"], ["zoom"], 11, 1, 18, 5] } },
    { id: "road-primary", type: "line", source: "openmaptiles", "source-layer": "transportation",
      filter: ["in", "class", "primary", "trunk"],
      paint: { "line-color": "#a8d8ff", "line-width": ["interpolate", ["linear"], ["zoom"], 11, 1.5, 18, 7] } },
    { id: "road-motorway", type: "line", source: "openmaptiles", "source-layer": "transportation",
      filter: ["==", "class", "motorway"],
      paint: { "line-color": "#fbbf24", "line-width": ["interpolate", ["linear"], ["zoom"], 11, 2, 18, 9] } },
    // 3D buildings — extruded
    { id: "buildings-3d", type: "fill-extrusion", source: "openmaptiles", "source-layer": "building",
      minzoom: 14,
      paint: {
        "fill-extrusion-color": ["interpolate", ["linear"], ["get", "render_height"],
          0, "#0e3151", 20, "#155a86", 60, "#22d3ee", 120, "#67e8f9"],
        "fill-extrusion-height": ["coalesce", ["get", "render_height"], 8],
        "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
        "fill-extrusion-opacity": 0.9,
      } },
    // place labels
    { id: "place-city", type: "symbol", source: "openmaptiles", "source-layer": "place",
      filter: ["in", "class", "city", "town"],
      layout: { "text-field": ["get", "name:latin"], "text-size": 12, "text-font": ["Noto Sans Regular"] },
      paint: { "text-color": "#67e8f9", "text-halo-color": "#020a14", "text-halo-width": 1.5 } },
  ],
  terrain: { source: "terrain-rgb", exaggeration: 1.2 },
  sky: {
    "sky-color": "#020a14",
    "horizon-color": "#0e3151",
    "fog-color": "#020a14",
    "fog-ground-blend": 0.6,
  },
};

export const STYLES = {
  normal: { id: "normal", label: "Normal", style: STYLE_NORMAL },
  satellite: { id: "satellite", label: "Satélite", style: STYLE_SATELLITE },
  threed: { id: "threed", label: "3D", style: STYLE_3D },
  vector3d: { id: "vector3d", label: "Vector 3D", style: STYLE_VECTOR_3D },
};
