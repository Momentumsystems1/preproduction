/**
 * Radial command configuration — 3 concentric rings × 6 slots each = 18 functions total.
 * Rings:
 *   OUTER  → Layers (what to SEE on the map)
 *   MIDDLE → Mode (HOW to move)
 *   INNER  → Action (WHAT to do now)
 *
 * Slot order = clockwise starting at 12 o'clock (index 0 at the top).
 */

// Tailwind color tokens kept in one place so visuals stay synced.
export const RING_THEME = {
  outer: {
    name: "CAPAS",
    color: "#22d3ee",       // cyan-400
    glow: "rgba(34,211,238,0.55)",
    bg: "rgba(34,211,238,0.06)",
    radius: 215,
    iconSize: 24,
  },
  middle: {
    name: "MODO",
    color: "#fbbf24",       // amber-400
    glow: "rgba(251,191,36,0.55)",
    bg: "rgba(251,191,36,0.06)",
    radius: 160,
    iconSize: 22,
  },
  inner: {
    name: "ACCIÓN",
    color: "#c084fc",       // violet-400
    glow: "rgba(192,132,252,0.55)",
    bg: "rgba(192,132,252,0.06)",
    radius: 110,
    iconSize: 20,
  },
};

export const RING_SLOTS = {
  outer: [
    { id: "traffic",  icon: "AlertTriangle", label: "Tráfico",     desc: "Atascos · incidentes · obras DGT/SCT en vivo" },
    { id: "parking",  icon: "ParkingCircle", label: "Parking",     desc: "Aparcamientos cercanos · plazas libres" },
    { id: "bikes",    icon: "Bike",          label: "Bicis/Patin", desc: "Estaciones GBFS · scooter compartido" },
    { id: "ev",       icon: "Zap",           label: "Cargadores",  desc: "Estaciones EV · velocidad de carga" },
    { id: "weather",  icon: "CloudRain",     label: "Clima",       desc: "Lluvia · temperatura · viento" },
    { id: "transit",  icon: "Train",         label: "Transporte",  desc: "Metro · bus · cercanías" },
  ],
  middle: [
    { id: "car",      icon: "Car",          label: "Coche",     desc: "Conducir privado · ruta directa" },
    { id: "transit",  icon: "Bus",          label: "Bus/Metro", desc: "Transporte público" },
    { id: "bike",     icon: "Bike",         label: "Bici",      desc: "Carril bici · GBFS compartido" },
    { id: "foot",     icon: "Footprints",   label: "Andar",     desc: "A pie · solo distancias cortas" },
    { id: "scooter",  icon: "Zap",          label: "Patinete",  desc: "Patinete eléctrico compartido" },
    { id: "taxi",     icon: "Car",          label: "Taxi/Uber", desc: "VTC · Uber sandbox · tarifa estimada" },
  ],
  inner: [
    { id: "origin",     icon: "MapPin",       label: "Origen",      desc: "Click en el mapa para fijar origen" },
    { id: "destination",icon: "Flag",         label: "Destino",     desc: "Click en el mapa para fijar destino" },
    { id: "route",      icon: "Route",        label: "Calcular",    desc: "Generar ruta multimodal con datos vivos" },
    { id: "measure",    icon: "Ruler",        label: "Medir",       desc: "Distancias entre 2+ puntos" },
    { id: "info",       icon: "Info",         label: "Info",        desc: "Detalle del punto activo" },
    { id: "reset",      icon: "RotateCcw",    label: "Reset",       desc: "Limpiar todo y empezar de cero" },
  ],
};

/**
 * Cross-ring smart links: when a slot on a ring is selected, the other rings
 * auto-rotate to their most "context-relevant" slot.
 */
export const SMART_LINKS = {
  // OUTER selected → suggest MIDDLE + INNER
  outer: {
    traffic:  { middle: "car",     inner: "route" },
    parking:  { middle: "car",     inner: "destination" },
    bikes:    { middle: "bike",    inner: "route" },
    ev:       { middle: "car",     inner: "destination" },
    weather:  { middle: "car",     inner: "info" },
    transit:  { middle: "transit", inner: "route" },
  },
  // MIDDLE selected → suggest OUTER + INNER
  middle: {
    car:     { outer: "traffic", inner: "route" },
    transit: { outer: "transit", inner: "route" },
    bike:    { outer: "bikes",   inner: "route" },
    foot:    { outer: "weather", inner: "destination" },
    scooter: { outer: "bikes",   inner: "destination" },
    taxi:    { outer: "traffic", inner: "destination" },
  },
  // INNER selected → suggest OUTER + MIDDLE (less destructive — only suggests outer)
  inner: {
    origin:      { outer: "traffic" },
    destination: { outer: "traffic" },
    route:       { outer: "traffic", middle: "car" },
    measure:     {},
    info:        {},
    reset:       {},
  },
};

/**
 * Skins for the Control core. User can cycle between them.
 */
export const CORE_SKINS = ["orb", "crystal", "minimal"];

/**
 * Given a list of map features and a screen-space position, find the nearest
 * one within `maxDistPx` pixels. Returns null if none.
 */
export function findNearestFeature(features, posPx, projectFn, maxDistPx = 80) {
  let best = null;
  let bestD = maxDistPx;
  for (const f of features) {
    if (!f.lat || !f.lon) continue;
    const p = projectFn([f.lon, f.lat]);
    const dx = p.x - posPx.x;
    const dy = p.y - posPx.y;
    const d = Math.hypot(dx, dy);
    if (d < bestD) { bestD = d; best = f; }
  }
  return best;
}

/** Compute degrees of rotation for a given slot index to be at 12 o'clock. */
export function rotationForSlot(slotIndex) {
  return -slotIndex * 60;
}

/** Round a rotation to the nearest 60° step (snap to slot). */
export function snapRotation(deg) {
  const stepped = Math.round(deg / 60) * 60;
  return stepped;
}

/** Given a current rotation in degrees, which slot index is at 12 o'clock? */
export function activeSlotIndex(rotationDeg) {
  const norm = ((-rotationDeg) % 360 + 360) % 360;
  return Math.round(norm / 60) % 6;
}
