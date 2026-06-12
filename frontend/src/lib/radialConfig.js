/**
 * Radial Command — context-driven modes & planets.
 *
 * The control behaves like a planetary system:
 *   - The central "sun" (CORE) holds the active mode + hover hint.
 *   - 3 orbits hold planets (icons).
 *   - Clicking a mode planet (OUTER) rotates the system: that planet stays
 *     bright at the top, others dim. The MIDDLE + INNER orbits repopulate
 *     with sub-actions / details for that mode.
 *   - A sub-action can trigger inline state (crosshair, label fill, etc.).
 */

// ---------------------------------------------------------------------------
//  Theme tokens (shared with RadialCommand)
// ---------------------------------------------------------------------------
export const RING_THEME = {
  outer:  { name: "MODOS",   color: "#22d3ee", glow: "rgba(34,211,238,0.55)", radius: 215, iconSize: 22 },
  middle: { name: "ACCIÓN",  color: "#fbbf24", glow: "rgba(251,191,36,0.55)", radius: 158, iconSize: 20 },
  inner:  { name: "DETALLE", color: "#c084fc", glow: "rgba(192,132,252,0.55)", radius: 105, iconSize: 18 },
};

export const CORE_SKINS = ["orb", "crystal", "minimal"];

// ---------------------------------------------------------------------------
//  Planet definitions
//   - icon: lucide-react icon name
//   - type: "mode" → switch mode on click; "action" → run an action handler
//   - action: identifier consumed by the parent (set origin, compute route…)
//   - stateLabels (optional): planet renders two text labels that turn green
//     as the parent fills them in (e.g. INICIO, DESTINO).
// ---------------------------------------------------------------------------
export const MODES = {
  // ===== MAIN MODE — entry point ==========================================
  main: {
    centerLabel: "Control",
    centerHint:  "Pasa el cursor por un planeta",
    parent: null,
    outer: [
      { id: "navegador", icon: "Route",        label: "Navegador", desc: "Planificar ruta multimodal",   type: "mode", targetMode: "navegador" },
      { id: "capas",     icon: "Layers",       label: "Capas",     desc: "Activar capas en el mapa",      type: "mode", targetMode: "capas" },
      { id: "info",      icon: "Info",         label: "Info",      desc: "Detalle de un punto o atasco",  type: "mode", targetMode: "info" },
      { id: "cerca",     icon: "Compass",      label: "Cerca",     desc: "POIs cerca del control",        type: "mode", targetMode: "cerca" },
      { id: "buscar",    icon: "Search",       label: "Buscar",    desc: "Geocodificar una dirección",    type: "mode", targetMode: "buscar" },
      { id: "yo",        icon: "User",         label: "Yo",        desc: "Mi posición y preferencias",    type: "mode", targetMode: "yo" },
    ],
    middle: [],
    inner: [],
  },

  // ===== NAVEGADOR — main user flow =======================================
  navegador: {
    centerLabel: "Navegador",
    centerHint:  "Establece puntos · transporte · optimiza",
    parent: "main",
    activeOuterId: "navegador",
    outer: "INHERIT_FROM_MAIN", // visually keep all outer planets, dim the non-active ones
    middle: [
      {
        id: "select_points", icon: "MapPinned", label: "Puntos",
        desc: "Click en el mapa para fijar inicio y destino",
        type: "action", action: "select_points",
        stateLabels: [{ key: "origin", text: "Inicio" }, { key: "destination", text: "Destino" }],
      },
      { id: "compute",  icon: "Zap",        label: "Optimizar", desc: "Calcular ruta multimodal con tráfico vivo", type: "action", action: "compute" },
      { id: "reverse",  icon: "ArrowLeftRight", label: "Invertir", desc: "Intercambiar inicio y destino",          type: "action", action: "reverse_points" },
      { id: "history",  icon: "Bookmark",   label: "Historial", desc: "Viajes anteriores",                         type: "action", action: "history" },
      { id: "reset",    icon: "RotateCcw",  label: "Limpiar",   desc: "Borrar puntos y ruta",                       type: "action", action: "reset" },
      { id: "back",     icon: "ArrowLeft",  label: "Volver",    desc: "Volver al panel principal",                  type: "mode",   targetMode: "main" },
    ],
    inner: [
      { id: "coche",   icon: "Car",         label: "Coche",     desc: "Modo conducir",      type: "select", group: "transport", value: "car",     defaultSelected: true },
      { id: "bus",     icon: "Bus",         label: "Bus/Metro", desc: "Transporte público", type: "select", group: "transport", value: "transit" },
      { id: "bici",    icon: "Bike",        label: "Bici",      desc: "Bicicleta",          type: "select", group: "transport", value: "bike" },
      { id: "andar",   icon: "Footprints",  label: "Andar",     desc: "A pie",              type: "select", group: "transport", value: "foot" },
      { id: "patin",   icon: "Zap",         label: "Patinete",  desc: "Patinete eléctrico", type: "select", group: "transport", value: "scooter" },
      { id: "taxi",    icon: "CarTaxiFront", label: "Taxi/Uber", desc: "VTC con tarifa estimada", type: "select", group: "transport", value: "taxi" },
    ],
  },

  // ===== CAPAS — toggle map layers ========================================
  capas: {
    centerLabel: "Capas",
    centerHint:  "Toggle capas sobre el mapa",
    parent: "main",
    activeOuterId: "capas",
    outer: "INHERIT_FROM_MAIN",
    middle: [
      { id: "trafico", icon: "AlertTriangle",  label: "Tráfico",   desc: "Atascos · obras · accidentes",    type: "toggle", action: "toggle_layer", value: "traffic"  },
      { id: "parking", icon: "ParkingCircle",  label: "Parking",   desc: "Aparcamientos cercanos",          type: "toggle", action: "toggle_layer", value: "parking"  },
      { id: "bicis",   icon: "Bike",           label: "Bicis",     desc: "Estaciones GBFS · patinetes",     type: "toggle", action: "toggle_layer", value: "bikes"    },
      { id: "ev",      icon: "Zap",            label: "EV",        desc: "Cargadores eléctricos",           type: "toggle", action: "toggle_layer", value: "ev"       },
      { id: "clima",   icon: "CloudRain",      label: "Clima",     desc: "Radar de lluvia · temperatura",   type: "toggle", action: "toggle_layer", value: "weather"  },
      { id: "back",    icon: "ArrowLeft",      label: "Volver",    desc: "Volver al panel principal",       type: "mode",   targetMode: "main" },
    ],
    inner: [],
  },

  // ===== INFO ============================================================
  info: {
    centerLabel: "Info",
    centerHint:  "Click sobre el mapa para inspeccionar",
    parent: "main",
    activeOuterId: "info",
    outer: "INHERIT_FROM_MAIN",
    middle: [
      { id: "pick",      icon: "Crosshair",    label: "Sobre punto",  desc: "Click en el mapa para detalle",  type: "action", action: "pick_info" },
      { id: "incident",  icon: "AlertTriangle", label: "Atascos",     desc: "Listar incidentes visibles",    type: "action", action: "list_incidents" },
      { id: "weather",   icon: "CloudRain",    label: "Clima",        desc: "Clima en el centro del mapa",    type: "action", action: "show_weather" },
      { id: "share",     icon: "Share2",       label: "Compartir",    desc: "Enlace de la vista actual",      type: "action", action: "share_view" },
      { id: "report",    icon: "Megaphone",    label: "Reportar",     desc: "Reportar incidente (mock)",      type: "action", action: "report" },
      { id: "back",      icon: "ArrowLeft",    label: "Volver",       desc: "Volver al panel principal",      type: "mode",   targetMode: "main" },
    ],
    inner: [],
  },

  // ===== CERCA — POIs cerca del control ====================================
  cerca: {
    centerLabel: "Cerca",
    centerHint:  "POIs cerca del control",
    parent: "main",
    activeOuterId: "cerca",
    outer: "INHERIT_FROM_MAIN",
    middle: [
      { id: "park_near",   icon: "ParkingCircle", label: "Parking",   desc: "Plazas libres cerca",          type: "action", action: "search_nearby", value: "parking" },
      { id: "ev_near",     icon: "Zap",           label: "EV",        desc: "Cargadores cerca",              type: "action", action: "search_nearby", value: "ev" },
      { id: "bike_near",   icon: "Bike",          label: "Bicis",     desc: "Estaciones GBFS cerca",         type: "action", action: "search_nearby", value: "bikes" },
      { id: "food_near",   icon: "Utensils",      label: "Comer",     desc: "Restaurantes cerca",            type: "action", action: "search_nearby", value: "food" },
      { id: "shop_near",   icon: "ShoppingBag",   label: "Tiendas",   desc: "Comercio cerca",                type: "action", action: "search_nearby", value: "shop" },
      { id: "back",        icon: "ArrowLeft",     label: "Volver",    desc: "Volver al panel principal",     type: "mode",   targetMode: "main" },
    ],
    inner: [],
  },

  // ===== BUSCAR — Geocoder ================================================
  buscar: {
    centerLabel: "Buscar",
    centerHint:  "Escribe en el centro o usa voz",
    parent: "main",
    activeOuterId: "buscar",
    outer: "INHERIT_FROM_MAIN",
    middle: [
      { id: "text",    icon: "Search",     label: "Texto",     desc: "Escribir dirección",         type: "action", action: "open_geocoder" },
      { id: "voice",   icon: "Mic",        label: "Voz",       desc: "Hablar dirección (futuro)",  type: "action", action: "voice_search" },
      { id: "recent",  icon: "Clock",      label: "Recientes", desc: "Búsquedas recientes",        type: "action", action: "recent_searches" },
      { id: "saved",   icon: "Bookmark",   label: "Guardado",  desc: "Lugares guardados",          type: "action", action: "saved_places" },
      { id: "near",    icon: "MapPin",     label: "Cerca",     desc: "POIs alrededor",             type: "mode",   targetMode: "cerca" },
      { id: "back",    icon: "ArrowLeft",  label: "Volver",    desc: "Volver al panel principal",  type: "mode",   targetMode: "main" },
    ],
    inner: [],
  },

  // ===== YO — usuario =====================================================
  yo: {
    centerLabel: "Yo",
    centerHint:  "Preferencias y posición",
    parent: "main",
    activeOuterId: "yo",
    outer: "INHERIT_FROM_MAIN",
    middle: [
      { id: "loc",       icon: "Crosshair",   label: "Mi pos.",   desc: "Centrar mapa en mi ubicación",  type: "action", action: "locate_me" },
      { id: "skin",      icon: "Palette",     label: "Aspecto",   desc: "Cambiar skin del control",      type: "action", action: "cycle_skin" },
      { id: "minimize",  icon: "Minimize2",   label: "Minimizar", desc: "Reducir el control",            type: "action", action: "minimize" },
      { id: "expert",    icon: "Wrench",      label: "Experto",   desc: "Abrir HUD avanzado",            type: "action", action: "expert_mode" },
      { id: "help",      icon: "HelpCircle",  label: "Ayuda",     desc: "Atajos y guía rápida",          type: "action", action: "help" },
      { id: "back",      icon: "ArrowLeft",   label: "Volver",    desc: "Volver al panel principal",     type: "mode",   targetMode: "main" },
    ],
    inner: [],
  },
};

/**
 * Resolve the visible planet list for a given orbit + mode.
 * - When a mode is non-main and its outer = "INHERIT_FROM_MAIN" we return the
 *   main outer list so the user still sees all macro modes (dimmed visually).
 */
export function planetsFor(mode, orbit) {
  const m = MODES[mode];
  if (!m) return [];
  let raw = m[orbit];
  if (raw === "INHERIT_FROM_MAIN") raw = MODES.main.outer;
  return raw || [];
}

/** Default rotation that places a slot at 12 o'clock. */
export function rotationForSlot(idx) {
  return -idx * 60;
}

/** Inverse: given a rotation, which slot index is at top? */
export function activeSlotIndex(rotationDeg) {
  const norm = ((-rotationDeg) % 360 + 360) % 360;
  return Math.round(norm / 60) % 6;
}

/** Given a planets array, locate the index of one by id. */
export function indexOfPlanet(planets, id) {
  return planets.findIndex(p => p.id === id);
}
