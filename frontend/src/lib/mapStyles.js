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

export const STYLES = {
  normal: { id: "normal", label: "Normal", style: STYLE_NORMAL },
  satellite: { id: "satellite", label: "Satélite", style: STYLE_SATELLITE },
  threed: { id: "threed", label: "3D", style: STYLE_3D },
};
