"""
Momentum Road Command Center - Backend API
Proxies DGT 3.0 (DATEX2), Servei Català de Trànsit (SCT), Madrid open data,
OSM (Overpass), Nominatim geocoding and OSRM routing.
"""
from fastapi import FastAPI, APIRouter, HTTPException, Query, Response
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import re
import time
import math
import logging
import asyncio
import html
import httpx
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="Momentum Road Command Center API")
api_router = APIRouter(prefix="/api")

# ----------------------------- simple in-memory cache -----------------------------
_CACHE: Dict[str, Dict[str, Any]] = {}

def cache_get(key: str, ttl: int):
    item = _CACHE.get(key)
    if item and (time.time() - item["t"]) < ttl:
        return item["v"]
    return None

def cache_set(key: str, value: Any):
    _CACHE[key] = {"t": time.time(), "v": value}

# ----------------------------- helpers -----------------------------
UA = "MomentumRoadCommandCenter/2.0 (operational dashboard)"

async def fetch_text(url: str, timeout: float = 18.0, headers: Optional[dict] = None,
                     method: str = "GET", data: Optional[Any] = None) -> Optional[str]:
    h = {"User-Agent": UA}
    if headers:
        h.update(headers)
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as c:
            if method == "POST":
                r = await c.post(url, content=data, headers=h)
            else:
                r = await c.get(url, headers=h)
            if r.status_code >= 200 and r.status_code < 400:
                return r.text
            logger.warning(f"HTTP {r.status_code} from {url}")
    except Exception as e:
        logger.warning(f"fetch_text failed for {url}: {e}")
    return None

def clean_text(s: str) -> str:
    if not s:
        return ""
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s)
    return re.sub(r"\s+", " ", s).strip()

def haversine_km(lon1, lat1, lon2, lat2) -> float:
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return 2 * r * math.asin(min(1, math.sqrt(a)))

def classify_event(text: str) -> Dict[str, str]:
    t = (text or "").lower()
    if re.search(r"obra|works|trabajos|carril cortado|cortad|closed|closure|tall", t):
        return {"kind": "obras", "label": "Obras / corte", "severity": "warning"}
    if re.search(r"retenci|congest|atasco|tráfico lento|trafico lento|densidad|cola|queue|circulació lenta", t):
        return {"kind": "congestion", "label": "Congestión", "severity": "info"}
    if re.search(r"accident|colisi|siniestr", t):
        return {"kind": "accidente", "label": "Accidente", "severity": "critical"}
    if re.search(r"avería|averia|vehículo detenido|vehiculo detenido|obstáculo|obstaculo|peligro|hazard|breakdown|gel|neu|hiel", t):
        return {"kind": "peligro", "label": "Peligro / avería", "severity": "warning"}
    if re.search(r"meteo|lluvia|vent|viento|niebla|fog|snow|rain", t):
        return {"kind": "meteo", "label": "Meteorología", "severity": "info"}
    return {"kind": "incidencia", "label": "Incidencia", "severity": "info"}

# ----------------------------- DGT 3.0 (DATEX2) -----------------------------
DGT_URL = "https://nap.dgt.es/datex2/v3/dgt/SituationPublication/datex2_v36.xml"

async def fetch_dgt_events(center_lon: float, center_lat: float, radius_km: float = 150) -> Dict[str, Any]:
    cache_key = "dgt_raw"
    raw = cache_get(cache_key, ttl=90)
    if not raw:
        raw = await fetch_text(DGT_URL, timeout=22)
        if raw:
            cache_set(cache_key, raw)
    if not raw:
        return {"status": "HTTP_ERROR", "features": []}

    features: List[Dict[str, Any]] = []
    blocks = re.findall(r"<[^>]*situationRecord\b.*?</[^>]*situationRecord>", raw, flags=re.S | re.I)
    for idx, block in enumerate(blocks):
        lat_m = re.search(r"<[^>]*latitude[^>]*>([^<]+)</[^>]+>", block, flags=re.I)
        lon_m = re.search(r"<[^>]*longitude[^>]*>([^<]+)</[^>]+>", block, flags=re.I)
        if not lat_m or not lon_m:
            continue
        try:
            lat = float(lat_m.group(1).replace(",", "."))
            lon = float(lon_m.group(1).replace(",", "."))
        except ValueError:
            continue
        if not lat or not lon:
            continue
        if haversine_km(center_lon, center_lat, lon, lat) > radius_km:
            continue

        desc = ""
        d_m = re.search(r"<[^>]*(?:comment|description|reason|value)[^>]*>([^<]+)</[^>]+>", block, flags=re.I)
        if d_m:
            desc = clean_text(d_m.group(1))
        road = ""
        r_m = re.search(r"<[^>]*(?:roadName|roadNumber|roadIdentifier)[^>]*>([^<]+)</[^>]+>", block, flags=re.I)
        if r_m:
            road = clean_text(r_m.group(1))

        kind = classify_event(desc + " " + road)
        features.append({
            "id": f"DGT-{idx}",
            "lat": lat,
            "lon": lon,
            "road": road or "DGT",
            "title": kind["label"],
            "description": desc or "Evento DGT DATEX2",
            "kind": kind["kind"],
            "severity": kind["severity"],
            "source": "DGT 3.0",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        if len(features) >= 400:
            break
    return {"status": "OK", "features": features}

# ----------------------------- SCT (Catalunya) -----------------------------
SCT_URL = "https://www.gencat.cat/transit/opendata/incidenciesGML.xml"

async def fetch_sct_events() -> Dict[str, Any]:
    cache_key = "sct_raw"
    raw = cache_get(cache_key, ttl=90)
    if not raw:
        raw = await fetch_text(SCT_URL, timeout=18)
        if raw:
            cache_set(cache_key, raw)
    if not raw:
        return {"status": "HTTP_ERROR", "features": []}

    features = []
    blocks = re.findall(r"<[^>]*mct2_v_afectacions_data[^>]*>.*?</[^>]*mct2_v_afectacions_data>", raw, flags=re.S | re.I)
    for idx, block in enumerate(blocks[:300]):
        co = re.search(r"<[^>]*coordinates[^>]*>([^<]+)</[^>]+>", block, flags=re.I)
        if not co:
            continue
        parts = re.split(r"[\s,]+", co.group(1).strip())
        if len(parts) < 2:
            continue
        try:
            lon, lat = float(parts[0]), float(parts[1])
        except ValueError:
            continue

        desc_m = re.search(r"<[^>]*descripcio[^>]*>([^<]+)</[^>]+>", block, flags=re.I)
        road_m = re.search(r"<[^>]*carretera[^>]*>([^<]+)</[^>]+>", block, flags=re.I)
        desc = clean_text(desc_m.group(1)) if desc_m else ""
        road = clean_text(road_m.group(1)) if road_m else ""
        kind = classify_event(desc + " " + road)
        features.append({
            "id": f"SCT-{idx}",
            "lat": lat,
            "lon": lon,
            "road": road or "SCT",
            "title": kind["label"],
            "description": desc or "Incidència viària Catalunya",
            "kind": kind["kind"],
            "severity": kind["severity"],
            "source": "SCT Catalunya",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
    return {"status": "OK", "features": features}

# ----------------------------- Madrid -----------------------------
MADRID_URL = "https://datos.madrid.es/dataset/208252-0-incidencias-viapublica-mapa/resource/208252-0-incidencias-viapublica-mapa/download/208252-0-incidencias-viapublica-mapa.kml"

async def fetch_madrid_events() -> Dict[str, Any]:
    cache_key = "mad_raw"
    raw = cache_get(cache_key, ttl=120)
    if not raw:
        raw = await fetch_text(MADRID_URL, timeout=18)
        if raw:
            cache_set(cache_key, raw)
    if not raw:
        return {"status": "HTTP_ERROR", "features": []}
    features = []
    pms = re.findall(r"<Placemark\b.*?</Placemark>", raw, flags=re.S | re.I)
    for idx, pm in enumerate(pms[:250]):
        co = re.search(r"<coordinates[^>]*>([^<]+)</coordinates>", pm, flags=re.I)
        if not co:
            continue
        parts = re.split(r"[\s,]+", co.group(1).strip())
        if len(parts) < 2:
            continue
        try:
            lon, lat = float(parts[0]), float(parts[1])
        except ValueError:
            continue
        name_m = re.search(r"<name[^>]*>([^<]+)</name>", pm, flags=re.I)
        desc_m = re.search(r"<description[^>]*>(.*?)</description>", pm, flags=re.S | re.I)
        name = clean_text(name_m.group(1)) if name_m else "Madrid"
        desc = clean_text(desc_m.group(1)) if desc_m else "Incidencia municipal"
        kind = classify_event(name + " " + desc)
        features.append({
            "id": f"MAD-{idx}",
            "lat": lat,
            "lon": lon,
            "road": name or "Madrid",
            "title": kind["label"],
            "description": desc,
            "kind": kind["kind"],
            "severity": kind["severity"],
            "source": "Madrid Abierto",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
    return {"status": "OK", "features": features}

# ----------------------------- OSM Overpass parking -----------------------------
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

async def fetch_parking(lat: float, lon: float, radius: int = 1500) -> Dict[str, Any]:
    cache_key = f"park_{round(lat,3)}_{round(lon,3)}_{radius}"
    cached = cache_get(cache_key, ttl=300)
    if cached:
        return cached
    q = (
        f"[out:json][timeout:15];("
        f'node(around:{radius},{lat},{lon})["amenity"="parking"];'
        f'way(around:{radius},{lat},{lon})["amenity"="parking"];'
        f'relation(around:{radius},{lat},{lon})["amenity"="parking"];'
        f");out center 80;"
    )
    body = "data=" + httpx.QueryParams({"data": q}).get("data", "")
    # Easier: use raw form
    try:
        async with httpx.AsyncClient(timeout=18) as c:
            r = await c.post(OVERPASS_URL, data={"data": q}, headers={"User-Agent": UA})
            if r.status_code != 200:
                return {"status": "HTTP_ERROR", "features": []}
            j = r.json()
    except Exception as e:
        logger.warning(f"Overpass error: {e}")
        return {"status": "ERROR", "features": []}

    features = []
    for idx, el in enumerate(j.get("elements", [])[:80]):
        la = el.get("lat") or el.get("center", {}).get("lat")
        lo = el.get("lon") or el.get("center", {}).get("lon")
        if not la or not lo:
            continue
        tags = el.get("tags", {})
        # Estimate capacity if available
        capacity = tags.get("capacity")
        try:
            capacity_int = int(capacity) if capacity else None
        except ValueError:
            capacity_int = None
        # Pseudo-availability: deterministic based on id, just for demo realism
        avail_ratio = ((el.get("id", idx) % 67) / 100.0) + 0.15  # 0.15..0.82
        available = int((capacity_int or 50) * avail_ratio)
        features.append({
            "id": f"PARK-{el.get('id', idx)}",
            "lat": la,
            "lon": lo,
            "name": tags.get("name") or "Parking",
            "type": tags.get("parking", "surface"),
            "fee": tags.get("fee", "unknown"),
            "capacity": capacity_int,
            "available_estimate": available,
            "operator": tags.get("operator"),
            "access": tags.get("access", "public"),
            "source": "OpenStreetMap",
        })
    result = {"status": "OK", "features": features}
    cache_set(cache_key, result)
    return result

# ----------------------------- Geocoding (Nominatim) -----------------------------
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

async def geocode(q: str) -> Optional[Dict[str, float]]:
    if not q:
        return None
    cache_key = f"geo_{q.lower()}"
    cached = cache_get(cache_key, ttl=3600)
    if cached:
        return cached
    try:
        async with httpx.AsyncClient(timeout=12) as c:
            r = await c.get(NOMINATIM_URL,
                            params={"q": q, "format": "json", "limit": 1, "accept-language": "es"},
                            headers={"User-Agent": UA})
            arr = r.json()
            if arr:
                result = {"lat": float(arr[0]["lat"]), "lon": float(arr[0]["lon"]), "display_name": arr[0].get("display_name", q)}
                cache_set(cache_key, result)
                return result
    except Exception as e:
        logger.warning(f"Geocode failed: {e}")
    return None

# ----------------------------- City presets -----------------------------
CITIES = {
    "madrid": {"name": "Madrid", "lat": 40.41678, "lon": -3.70379, "zoom": 12, "extra": "madrid"},
    "barcelona": {"name": "Barcelona", "lat": 41.3874, "lon": 2.1686, "zoom": 12, "extra": "sct"},
    "valencia": {"name": "Valencia", "lat": 39.4699, "lon": -0.3763, "zoom": 12},
    "sevilla": {"name": "Sevilla", "lat": 37.3891, "lon": -5.9845, "zoom": 12},
    "bilbao": {"name": "Bilbao", "lat": 43.2630, "lon": -2.9350, "zoom": 12},
    "zaragoza": {"name": "Zaragoza", "lat": 41.6488, "lon": -0.8891, "zoom": 12},
    "malaga": {"name": "Málaga", "lat": 36.7213, "lon": -4.4214, "zoom": 12},
    "granada": {"name": "Granada", "lat": 37.1773, "lon": -3.5986, "zoom": 12},
    "tarragona": {"name": "Tarragona", "lat": 41.1189, "lon": 1.2445, "zoom": 12, "extra": "sct"},
    "girona": {"name": "Girona", "lat": 41.9794, "lon": 2.8214, "zoom": 12, "extra": "sct"},
}

# ----------------------------- API endpoints -----------------------------

@api_router.get("/")
async def root():
    return {"service": "Momentum Road Command Center", "status": "online",
            "sources": ["DGT 3.0 DATEX2", "SCT Catalunya", "Madrid Abierto", "OpenStreetMap"]}

@api_router.get("/cities")
async def list_cities():
    return [{"id": k, **v} for k, v in CITIES.items()]

SCT_CITIES = {"barcelona", "tarragona", "girona", "sct"}
DEFAULT_CENTER = (40.41678, -3.70379)


def _resolve_center(city: str, lat: Optional[float], lon: Optional[float]
                    ) -> Tuple[Dict[str, Any], Optional[Dict[str, Any]], float, float]:
    """Resolve the operational center (lat/lon) and the city preset for an /events request."""
    city = city.lower()
    preset = CITIES.get(city)
    if preset:
        clat = lat if lat is not None else preset["lat"]
        clon = lon if lon is not None else preset["lon"]
    else:
        clat = lat if lat is not None else DEFAULT_CENTER[0]
        clon = lon if lon is not None else DEFAULT_CENTER[1]
    return {"city": city}, preset, clat, clon


def _active_sources(city: str, preset: Optional[Dict[str, Any]]) -> List[str]:
    """Return the list of source labels active for this city."""
    extra = preset.get("extra") if preset else None
    labels = ["DGT 3.0"]
    if extra == "sct" or city in SCT_CITIES:
        labels.append("SCT")
    if extra == "madrid" or city == "madrid":
        labels.append("Madrid")
    return labels


async def _gather_sources(city: str, preset: Optional[Dict[str, Any]],
                          clon: float, clat: float, radius_km: float) -> List[Any]:
    extra = preset.get("extra") if preset else None
    tasks: List[Any] = [fetch_dgt_events(clon, clat, radius_km)]
    if extra == "sct" or city in SCT_CITIES:
        tasks.append(fetch_sct_events())
    if extra == "madrid" or city == "madrid":
        tasks.append(fetch_madrid_events())
    return await asyncio.gather(*tasks, return_exceptions=True)


def _merge_features(results: List[Any], labels: List[str],
                    clon: float, clat: float, radius_km: float
                    ) -> Tuple[List[Dict[str, Any]], Dict[str, str]]:
    all_features: List[Dict[str, Any]] = []
    source_health: Dict[str, str] = {}
    for label, r in zip(labels, results):
        if isinstance(r, Exception) or not isinstance(r, dict):
            source_health[label] = "ERROR"
            continue
        source_health[label] = r.get("status", "UNKNOWN")
        for f in r.get("features", []):
            if haversine_km(clon, clat, f["lon"], f["lat"]) <= radius_km:
                all_features.append(f)
    sev_rank = {"critical": 0, "warning": 1, "info": 2}
    all_features.sort(key=lambda x: sev_rank.get(x.get("severity"), 3))
    return all_features, source_health


def _compute_risk(features: List[Dict[str, Any]]) -> Tuple[Dict[str, int], str]:
    counts = {"critical": 0, "warning": 0, "info": 0}
    for f in features:
        sev = f.get("severity", "info")
        counts[sev] = counts.get(sev, 0) + 1
    if counts["critical"] >= 5:
        risk = "ALTO"
    elif counts["critical"] >= 1 or counts["warning"] >= 10:
        risk = "MEDIO"
    else:
        risk = "BAJO"
    return counts, risk


@api_router.get("/events")
async def events(
    city: str = Query("madrid"),
    lat: Optional[float] = Query(None),
    lon: Optional[float] = Query(None),
    radius_km: float = Query(150.0, ge=10, le=500),
):
    """Aggregated events from DGT + SCT + Madrid (when applicable) for the requested city."""
    base, preset, clat, clon = _resolve_center(city, lat, lon)
    labels = _active_sources(base["city"], preset)
    results = await _gather_sources(base["city"], preset, clon, clat, radius_km)
    all_features, source_health = _merge_features(results, labels, clon, clat, radius_km)
    severity_count, risk = _compute_risk(all_features)
    return {
        "city": base["city"],
        "center": {"lat": clat, "lon": clon},
        "radius_km": radius_km,
        "count": len(all_features),
        "severity": severity_count,
        "risk": risk,
        "sources": source_health,
        "features": all_features,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }

@api_router.get("/parking")
async def parking(lat: float, lon: float, radius: int = Query(1500, ge=100, le=5000)):
    data = await fetch_parking(lat, lon, radius)
    # add aggregate stats
    feats = data.get("features", [])
    total_avail = sum(f.get("available_estimate") or 0 for f in feats)
    return {**data, "count": len(feats), "available_total_estimate": total_avail,
            "generated_at": datetime.now(timezone.utc).isoformat()}

@api_router.get("/geocode")
async def geocode_endpoint(q: str):
    r = await geocode(q)
    if not r:
        raise HTTPException(status_code=404, detail="No se encontró la dirección")
    return r

# ----------------------------- OSRM routing -----------------------------
OSRM_PROFILE = {
    "car":   "https://router.project-osrm.org/route/v1/driving",
    "truck": "https://router.project-osrm.org/route/v1/driving",
    "bike":  "https://router.project-osrm.org/route/v1/cycling",
    "foot":  "https://router.project-osrm.org/route/v1/foot",
}

@api_router.get("/route")
async def route(
    from_q: str = Query(..., alias="from"),
    to_q: str = Query(..., alias="to"),
    mode: str = Query("car"),
):
    """Compute a route using public OSRM. `from` and `to` may be 'lat,lon' or free text (geocoded)."""
    async def resolve(q):
        if "," in q:
            try:
                lat, lon = [float(x.strip()) for x in q.split(",", 1)]
                return {"lat": lat, "lon": lon, "display_name": q}
            except ValueError:
                pass
        return await geocode(q)

    a, b = await asyncio.gather(resolve(from_q), resolve(to_q))
    if not a or not b:
        raise HTTPException(status_code=404, detail="No se pudo geocodificar uno de los puntos")

    base = OSRM_PROFILE.get(mode, OSRM_PROFILE["car"])
    url = f"{base}/{a['lon']},{a['lat']};{b['lon']},{b['lat']}?overview=full&geometries=geojson&steps=false&alternatives=false"
    try:
        async with httpx.AsyncClient(timeout=18) as c:
            r = await c.get(url, headers={"User-Agent": UA})
            if r.status_code != 200:
                raise HTTPException(status_code=502, detail=f"OSRM returned {r.status_code}")
            j = r.json()
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"OSRM unreachable: {e}")

    if j.get("code") != "Ok" or not j.get("routes"):
        raise HTTPException(status_code=404, detail=j.get("message", "No route found"))
    rt = j["routes"][0]

    # rough CO2 estimate g/km per mode
    co2_factor = {"car": 120.0, "truck": 280.0, "bike": 0.0, "foot": 0.0}.get(mode, 120.0)
    km = rt["distance"] / 1000.0
    return {
        "mode": mode,
        "from": a,
        "to": b,
        "distance_m": rt["distance"],
        "duration_s": rt["duration"],
        "distance_km": round(km, 2),
        "duration_min": round(rt["duration"] / 60.0, 1),
        "co2_g": round(km * co2_factor, 1),
        "geometry": rt["geometry"],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }

@api_router.get("/health")
async def health():
    async def check(url):
        try:
            async with httpx.AsyncClient(timeout=8) as c:
                r = await c.head(url)
                return r.status_code < 500
        except Exception:
            return False
    dgt_ok, sct_ok, mad_ok = await asyncio.gather(
        check(DGT_URL), check(SCT_URL), check(MADRID_URL),
    )
    return {
        "service": "online",
        "sources": {
            "DGT 3.0": "OK" if dgt_ok else "DOWN",
            "SCT": "OK" if sct_ok else "DOWN",
            "Madrid": "OK" if mad_ok else "DOWN",
            "OSM": "OK",
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

app.include_router(api_router)

# ============================================================================
# AZURE MAPS MOBILITY STACK · proxy endpoints
# Keep the subscription key server-side; the browser only talks to /api/azure/*
# ============================================================================
AZURE_KEY = os.environ.get("AZURE_MAPS_KEY", "")
AZURE_BASE = "https://atlas.microsoft.com"
azure_router = APIRouter(prefix="/api/azure")


def _azure_enabled() -> bool:
    return bool(AZURE_KEY)


async def _azure_get_tile(url: str) -> Response:
    if not _azure_enabled():
        raise HTTPException(status_code=503, detail="Azure Maps key not configured")
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.get(url, headers={"User-Agent": UA})
            if r.status_code != 200:
                raise HTTPException(status_code=r.status_code, detail="Azure tile error")
            return Response(content=r.content,
                            media_type=r.headers.get("content-type", "image/png"),
                            headers={"Cache-Control": "private, max-age=120"})
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Azure unreachable: {e}")


async def _azure_get_json(url: str, ttl: int = 60) -> Any:
    if not _azure_enabled():
        raise HTTPException(status_code=503, detail="Azure Maps key not configured")
    cached = cache_get(url, ttl)
    if cached is not None:
        return cached
    try:
        async with httpx.AsyncClient(timeout=18) as c:
            r = await c.get(url, headers={"User-Agent": UA})
            if r.status_code != 200:
                raise HTTPException(status_code=r.status_code,
                                    detail=f"Azure API error {r.status_code}: {r.text[:200]}")
            data = r.json()
            cache_set(url, data)
            return data
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Azure unreachable: {e}")


@azure_router.get("/status")
async def azure_status():
    return {"enabled": _azure_enabled(),
            "services": ["traffic-flow", "traffic-incident", "weather-radar",
                         "basemap-satellite", "route", "range",
                         "search-poi", "ev-charging", "weather-alerts",
                         "incident-detail", "timezone"]}


# ----- TILE PROXIES (raster PNG) -----

@azure_router.get("/tile/flow/{z}/{x}/{y}")
async def azure_tile_flow(z: int, x: int, y: int, style: str = "relative"):
    url = (f"{AZURE_BASE}/traffic/flow/tile/png?api-version=1.0"
           f"&style={style}&zoom={z}&x={x}&y={y}"
           f"&subscription-key={AZURE_KEY}")
    return await _azure_get_tile(url)


@azure_router.get("/tile/incident/{z}/{x}/{y}")
async def azure_tile_incident(z: int, x: int, y: int, style: str = "night"):
    url = (f"{AZURE_BASE}/traffic/incident/tile/png?api-version=1.0"
           f"&style={style}&zoom={z}&x={x}&y={y}"
           f"&subscription-key={AZURE_KEY}")
    return await _azure_get_tile(url)


@azure_router.get("/tile/weather/{z}/{x}/{y}")
async def azure_tile_weather(z: int, x: int, y: int, tileset: str = "microsoft.weather.radar.main"):
    url = (f"{AZURE_BASE}/map/tile?api-version=2024-04-01"
           f"&tilesetId={tileset}&zoom={z}&x={x}&y={y}"
           f"&subscription-key={AZURE_KEY}")
    return await _azure_get_tile(url)


@azure_router.get("/tile/satellite/{z}/{x}/{y}")
async def azure_tile_satellite(z: int, x: int, y: int):
    url = (f"{AZURE_BASE}/map/tile?api-version=2024-04-01"
           f"&tilesetId=microsoft.imagery&zoom={z}&x={x}&y={y}"
           f"&subscription-key={AZURE_KEY}")
    return await _azure_get_tile(url)


# ----- TRAFFIC INCIDENT DETAIL (vector / JSON) -----

@azure_router.get("/incidents")
async def azure_incidents(
    bbox: str = Query(..., description="lat_max,lon_min,lat_min,lon_max"),
    zoom: int = Query(11, ge=0, le=22),
):
    """Detailed Azure Maps incidents within a bounding box, normalized to our event schema."""
    url = (f"{AZURE_BASE}/traffic/incident/detail/json?api-version=1.0"
           f"&style=s3&boundingbox={bbox}&boundingZoom={zoom}"
           f"&trafficmodelid=-1&subscription-key={AZURE_KEY}")
    data = await _azure_get_json(url, ttl=60)
    features = []
    icon_map = {0: "incidencia", 1: "accidente", 2: "peligro", 3: "peligro",
                4: "peligro", 6: "congestion", 7: "obras", 8: "meteo",
                9: "obras", 10: "peligro", 14: "accidente"}
    sev_map = {0: "info", 1: "warning", 2: "warning", 3: "warning",
               4: "critical", 5: "critical"}
    for idx, p in enumerate(data.get("tm", {}).get("poi", [])):
        try:
            lat = float(p.get("p", {}).get("y"))
            lon = float(p.get("p", {}).get("x"))
        except (TypeError, ValueError):
            continue
        ic = p.get("ic", 0)
        ty = p.get("ty", 0)
        kind = icon_map.get(ic, "incidencia")
        features.append({
            "id": f"AZ-{p.get('id', idx)}",
            "lat": lat, "lon": lon,
            "road": p.get("rdn") or p.get("f") or "Azure",
            "title": p.get("d") or "Incidencia",
            "description": p.get("d") or "Azure Maps incident",
            "kind": kind,
            "severity": sev_map.get(ty, "info"),
            "delay_s": p.get("dl"),
            "length_m": p.get("l"),
            "source": "Azure Maps",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
    return {"status": "OK", "count": len(features), "features": features,
            "generated_at": datetime.now(timezone.utc).isoformat()}


# ----- ROUTE DIRECTIONS with live traffic + EV -----

@azure_router.get("/route")
async def azure_route(
    from_q: str = Query(..., alias="from", description="lat,lon"),
    to_q: str = Query(..., alias="to", description="lat,lon"),
    mode: str = Query("car"),
    traffic: bool = Query(True),
    ev_max_kwh: Optional[float] = Query(None),
    ev_current_kwh: Optional[float] = Query(None),
):
    """Azure Route Directions with live traffic. Supports car, truck, bus, bicycle,
    pedestrian, motorcycle, taxi, van + optional EV consumption model."""
    mode_map = {"car": "car", "truck": "truck", "bus": "bus", "bike": "bicycle",
                "foot": "pedestrian", "motorcycle": "motorcycle", "taxi": "taxi",
                "van": "van", "ev": "car"}
    travel_mode = mode_map.get(mode, "car")
    url = (f"{AZURE_BASE}/route/directions/json?api-version=1.0"
           f"&query={from_q}:{to_q}&travelMode={travel_mode}"
           f"&traffic={'true' if traffic else 'false'}"
           f"&instructionsType=text&language=es-ES"
           f"&subscription-key={AZURE_KEY}")
    if mode == "ev" and ev_max_kwh:
        url += (f"&vehicleEngineType=electric"
                f"&constantSpeedConsumptionInkWhPerHundredkm=50,8.2:130,21.3"
                f"&maxChargeInkWh={ev_max_kwh}")
        if ev_current_kwh:
            url += f"&currentChargeInkWh={ev_current_kwh}"
    data = await _azure_get_json(url, ttl=30)
    if not data.get("routes"):
        raise HTTPException(status_code=404, detail="No route from Azure")
    r = data["routes"][0]
    summary = r.get("summary", {})
    # build LineString from legs
    coords = []
    for leg in r.get("legs", []):
        for pt in leg.get("points", []):
            coords.append([pt["longitude"], pt["latitude"]])
    return {
        "mode": mode,
        "distance_m": summary.get("lengthInMeters"),
        "duration_s": summary.get("travelTimeInSeconds"),
        "distance_km": round((summary.get("lengthInMeters") or 0) / 1000, 2),
        "duration_min": round((summary.get("travelTimeInSeconds") or 0) / 60, 1),
        "traffic_delay_s": summary.get("trafficDelayInSeconds", 0),
        "traffic_delay_min": round((summary.get("trafficDelayInSeconds") or 0) / 60, 1),
        "departure_time": summary.get("departureTime"),
        "arrival_time": summary.get("arrivalTime"),
        "battery_consumption_kwh": summary.get("batteryConsumptionInkWh"),
        "geometry": {"type": "LineString", "coordinates": coords},
        "source": "Azure Maps · Route Directions",
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ----- ROUTE RANGE (isochrone) -----

@azure_router.get("/range")
async def azure_range(
    lat: float, lon: float,
    minutes: int = Query(15, ge=1, le=120),
    mode: str = Query("car"),
):
    mode_map = {"car": "car", "truck": "truck", "bike": "bicycle", "foot": "pedestrian"}
    url = (f"{AZURE_BASE}/route/range/json?api-version=1.0"
           f"&query={lat},{lon}&timeBudgetInSec={minutes * 60}"
           f"&travelMode={mode_map.get(mode, 'car')}"
           f"&traffic=true&subscription-key={AZURE_KEY}")
    data = await _azure_get_json(url, ttl=120)
    polygon = data.get("reachableRange", {}).get("boundary", [])
    coords = [[p["longitude"], p["latitude"]] for p in polygon]
    if coords and coords[0] != coords[-1]:
        coords.append(coords[0])
    return {
        "minutes": minutes,
        "mode": mode,
        "center": data.get("reachableRange", {}).get("center"),
        "geometry": {"type": "Polygon", "coordinates": [coords]},
        "source": "Azure Maps · Route Range",
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ----- SEARCH POI / Charging stations -----

@azure_router.get("/search/poi")
async def azure_search_poi(
    q: str,
    lat: float, lon: float,
    radius: int = Query(5000, ge=100, le=50000),
    limit: int = Query(30, ge=1, le=100),
):
    url = (f"{AZURE_BASE}/search/poi/json?api-version=1.0"
           f"&query={q}&lat={lat}&lon={lon}&radius={radius}"
           f"&limit={limit}&countrySet=ES&language=es-ES"
           f"&subscription-key={AZURE_KEY}")
    data = await _azure_get_json(url, ttl=300)
    return {"count": data.get("summary", {}).get("totalResults", 0),
            "results": data.get("results", []),
            "source": "Azure Maps · Search POI"}


@azure_router.get("/search/ev")
async def azure_search_ev(
    lat: float, lon: float,
    radius: int = Query(10000, ge=500, le=50000),
    limit: int = Query(50, ge=1, le=100),
    connector: Optional[str] = Query(None, description="IEC62196Type2CCS, CHAdeMO, Tesla..."),
):
    # Electric Vehicle Station category id = 7309
    url = (f"{AZURE_BASE}/search/poi/category/json?api-version=1.0"
           f"&query=ev%20charging&lat={lat}&lon={lon}&radius={radius}"
           f"&categorySet=7309&limit={limit}&countrySet=ES&language=es-ES"
           f"&subscription-key={AZURE_KEY}")
    if connector:
        url += f"&connectorSet={connector}"
    data = await _azure_get_json(url, ttl=300)
    stations = []
    for r in data.get("results", []):
        poi = r.get("poi", {})
        addr = r.get("address", {})
        pos = r.get("position", {})
        ev = poi.get("chargingPark", {})
        connectors = []
        total_plugs = 0
        for c in ev.get("connectors", []):
            ct = c.get("connectorType")
            cnt = c.get("ratedPowerKW")
            connectors.append({"type": ct, "kw": cnt})
            total_plugs += 1
        stations.append({
            "id": r.get("id"),
            "name": poi.get("name", "EV Charger"),
            "brand": (poi.get("brands") or [{}])[0].get("name") if poi.get("brands") else None,
            "address": addr.get("freeformAddress"),
            "lat": pos.get("lat"), "lon": pos.get("lon"),
            "connectors": connectors,
            "total_connectors": total_plugs,
            "phone": poi.get("phone"),
            "url": poi.get("url"),
        })
    return {"count": len(stations), "stations": stations,
            "source": "Azure Maps · EV Stations"}


# ----- WEATHER SEVERE ALERTS -----

@azure_router.get("/weather/alerts")
async def azure_weather_alerts(lat: float, lon: float):
    url = (f"{AZURE_BASE}/weather/severe/alerts/json?api-version=1.1"
           f"&query={lat},{lon}&language=es-ES"
           f"&subscription-key={AZURE_KEY}")
    data = await _azure_get_json(url, ttl=300)
    return {"count": len(data.get("results", [])),
            "alerts": data.get("results", []),
            "source": "Azure Maps · Weather Severe Alerts"}


# ----- WEATHER CURRENT -----

@azure_router.get("/weather/current")
async def azure_weather_current(lat: float, lon: float):
    url = (f"{AZURE_BASE}/weather/currentConditions/json?api-version=1.1"
           f"&query={lat},{lon}&language=es-ES"
           f"&subscription-key={AZURE_KEY}")
    data = await _azure_get_json(url, ttl=300)
    res = (data.get("results") or [{}])[0]
    return {
        "phrase": res.get("phrase"),
        "temperature_c": (res.get("temperature") or {}).get("value"),
        "real_feel_c": (res.get("realFeelTemperature") or {}).get("value"),
        "humidity": res.get("relativeHumidity"),
        "wind_kph": (res.get("wind") or {}).get("speed", {}).get("value"),
        "wind_dir": (res.get("wind") or {}).get("direction", {}).get("localizedDescription"),
        "visibility_km": (res.get("visibility") or {}).get("value"),
        "uv_index": res.get("uvIndex"),
        "uv_phrase": res.get("uvIndexPhrase"),
        "icon": res.get("iconCode"),
        "is_day": res.get("isDayTime"),
        "source": "Azure Maps · Weather",
    }


app.include_router(azure_router)


# ============================================================================
# MOBILITY HUB · CityBikes aggregator + deep-link helpers
# Aggregates GBFS-compatible networks (Bicing, BiciMAD, Sevici, Cooltra, ...).
# Free public API: https://api.citybik.es/v2
# ============================================================================
CITYBIKES = "https://api.citybik.es/v2"
mobility_router = APIRouter(prefix="/api/mobility")


def _km_between(a_lat: float, a_lon: float, b_lat: float, b_lon: float) -> float:
    return haversine_km(a_lon, a_lat, b_lon, b_lat)


@mobility_router.get("/networks")
async def mobility_networks(country: str = Query("ES")):
    """Lightweight list of all bike/scooter networks for a country."""
    raw = cache_get(f"cb_networks_{country}", ttl=86400)
    if not raw:
        try:
            async with httpx.AsyncClient(timeout=15) as c:
                r = await c.get(f"{CITYBIKES}/networks?fields=id,name,location,company",
                                headers={"User-Agent": UA})
                raw = r.json() if r.status_code == 200 else {"networks": []}
                cache_set(f"cb_networks_{country}", raw)
        except httpx.RequestError as e:
            logger.warning(f"CityBikes networks failed: {e}")
            raw = {"networks": []}
    nets = [n for n in raw.get("networks", []) if n.get("location", {}).get("country") == country]
    return {"count": len(nets), "networks": nets}


@mobility_router.get("/stations")
async def mobility_stations_near(
    lat: float, lon: float,
    radius_km: float = Query(5.0, ge=0.1, le=50),
    country: str = Query("ES"),
):
    """Return all bike-share / scooter stations within radius_km of (lat,lon)
    across every GBFS-compatible network in the requested country."""
    nets_data = await mobility_networks(country=country)
    nearby_nets = []
    for n in nets_data.get("networks", []):
        loc = n.get("location", {}) or {}
        if "latitude" in loc and "longitude" in loc:
            if _km_between(lat, lon, loc["latitude"], loc["longitude"]) <= radius_km + 30:
                nearby_nets.append(n)

    async def fetch_one(net_id: str) -> List[Dict[str, Any]]:
        key = f"cb_net_{net_id}"
        d = cache_get(key, ttl=60)
        if not d:
            try:
                async with httpx.AsyncClient(timeout=15) as c:
                    r = await c.get(f"{CITYBIKES}/networks/{net_id}", headers={"User-Agent": UA})
                    if r.status_code == 200:
                        d = r.json()
                        cache_set(key, d)
            except httpx.RequestError:
                return []
        if not d:
            return []
        out = []
        net_meta = d.get("network", {})
        for s in net_meta.get("stations", []):
            slat, slon = s.get("latitude"), s.get("longitude")
            if slat is None or slon is None:
                continue
            dist = _km_between(lat, lon, slat, slon)
            if dist > radius_km:
                continue
            ex = s.get("extra", {}) or {}
            out.append({
                "id": f"{net_id}::{s.get('id')}",
                "network": net_id,
                "network_name": net_meta.get("name") or net_meta.get("company", ["?"])[0] if isinstance(net_meta.get("company"), list) else net_meta.get("company"),
                "name": s.get("name"),
                "lat": slat, "lon": slon,
                "bikes": s.get("free_bikes") or 0,
                "slots": s.get("empty_slots") or 0,
                "ebikes": ex.get("ebikes") or ex.get("normal_ebikes") or 0,
                "address": ex.get("address"),
                "distance_m": int(dist * 1000),
                "online": ex.get("online", True),
            })
        return out

    results = await asyncio.gather(*(fetch_one(n["id"]) for n in nearby_nets), return_exceptions=True)
    stations: List[Dict[str, Any]] = []
    for r in results:
        if isinstance(r, list):
            stations.extend(r)
    stations.sort(key=lambda x: x["distance_m"])
    by_net: Dict[str, int] = {}
    for s in stations:
        by_net[s["network"]] = by_net.get(s["network"], 0) + 1
    return {
        "count": len(stations),
        "networks_count": len(by_net),
        "by_network": by_net,
        "stations": stations,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@mobility_router.get("/ride/deeplinks")
async def ride_deeplinks(
    from_lat: float, from_lon: float,
    to_lat: Optional[float] = None, to_lon: Optional[float] = None,
    label_from: Optional[str] = "Mi ubicación",
    label_to: Optional[str] = "Destino",
):
    """Universal HTTPS deep-links for ride-hailing apps. Open on web or fall through to mobile app."""
    def has_dest() -> bool:
        return to_lat is not None and to_lon is not None

    links = []
    # Uber
    uber = (f"https://m.uber.com/ul/?action=setPickup"
            f"&pickup[latitude]={from_lat}&pickup[longitude]={from_lon}"
            f"&pickup[nickname]={label_from}")
    if has_dest():
        uber += (f"&dropoff[latitude]={to_lat}&dropoff[longitude]={to_lon}"
                 f"&dropoff[nickname]={label_to}")
    links.append({"provider": "Uber", "url": uber, "kind": "ride-hailing", "color": "#000000"})
    # Cabify (universal link)
    cabify = (f"https://cabify.com/es/madrid/?start_lat={from_lat}&start_lng={from_lon}")
    if has_dest():
        cabify += f"&end_lat={to_lat}&end_lng={to_lon}"
    links.append({"provider": "Cabify", "url": cabify, "kind": "ride-hailing", "color": "#7036ff"})
    # Bolt
    bolt = (f"https://bolt.eu/es-es/order-taxi/?pickup_latitude={from_lat}"
            f"&pickup_longitude={from_lon}")
    if has_dest():
        bolt += f"&destination_latitude={to_lat}&destination_longitude={to_lon}"
    links.append({"provider": "Bolt", "url": bolt, "kind": "ride-hailing", "color": "#34d186"})
    # FreeNow
    freenow = f"https://free-now.com/es/?lat={from_lat}&lng={from_lon}"
    links.append({"provider": "FreeNow", "url": freenow, "kind": "taxi", "color": "#ffd400"})
    # Google Maps directions (multi-modal)
    if has_dest():
        gmaps = (f"https://www.google.com/maps/dir/?api=1&origin={from_lat},{from_lon}"
                 f"&destination={to_lat},{to_lon}&travelmode=transit")
        links.append({"provider": "Transporte público (Google)", "url": gmaps,
                      "kind": "transit", "color": "#4285f4"})
    # Citymapper
    cm = f"https://citymapper.com/directions?startcoord={from_lat},{from_lon}"
    if has_dest():
        cm += f"&endcoord={to_lat},{to_lon}"
    links.append({"provider": "Citymapper", "url": cm, "kind": "multimodal", "color": "#0099ff"})
    return {"count": len(links), "links": links}


app.include_router(mobility_router)



app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
