// Map styles configuration for MapLibre GL
// Using MapTiler/FreeMaps as the primary provider

export const STYLES = {
  normal: {
    id: "normal",
    label: "Normal",
    style: {
      version: 8,
      name: "OpenStreetMap",
      sources: {
        "osm-raster": {
          type: "raster",
          tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          tileSize: 256,
          attribution: "© OpenStreetMap contributors",
        },
      },
      layers: [
        {
          id: "osm-raster",
          type: "raster",
          source: "osm-raster",
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    },
  },
  satellite: {
    id: "satellite",
    label: "Satellite",
    style: {
      version: 8,
      name: "Satellite",
      sources: {
        "sat-raster": {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          ],
          tileSize: 256,
          attribution: "© Esri, DigitalGlobe, Earthstar Geographics",
        },
      },
      layers: [
        {
          id: "sat-raster",
          type: "raster",
          source: "sat-raster",
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    },
  },
  threed: {
    id: "threed",
    label: "3D Terrain",
    style: {
      version: 8,
      name: "3D Terrain",
      sources: {
        "osm-raster": {
          type: "raster",
          tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          tileSize: 256,
          attribution: "© OpenStreetMap contributors",
        },
        "terrain-rgb": {
          type: "raster-dem",
          tiles: [
            "https://cloud.maptiler.com/tiles/terrain-rgb/{z}/{x}/{y}.webp?key=get_your_key_here",
          ],
          tileSize: 256,
          attribution: "© MapTiler",
        },
      },
      layers: [
        {
          id: "osm-raster",
          type: "raster",
          source: "osm-raster",
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    },
  },
};

/**
 * Get FreeMaps style with your API key
 * Update with your actual MapTiler/FreeMaps key
 */
export const getFreemapsStyle = (apiKey) => {
  if (!apiKey) {
    console.warn("[MapStyles] No FreeMaps API key, using OSM fallback");
    return STYLES.normal.style;
  }

  return {
    version: 8,
    name: "FreeMaps OSM",
    sources: {
      "freemaps-raster": {
        type: "raster",
        tiles: [
          `https://api.maptiler.com/maps/openstreetmap/256/{z}/{x}/{y}.png?key=${apiKey}`,
        ],
        tileSize: 256,
        attribution: "© MapTiler, © OpenStreetMap contributors",
      },
    },
    layers: [
      {
        id: "freemaps-raster",
        type: "raster",
        source: "freemaps-raster",
        minzoom: 0,
        maxzoom: 19,
      },
    ],
  };
};
