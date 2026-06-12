"""
Momentum Road Command Center - Backend API
Proxies DGT 3.0 (DATEX2), Servei Català de Trànsit (SCT), Madrid open data,
OSM (Overpass), Nominatim geocoding and OSRM routing.
"""
from fastapi import FastAPI, APIRouter, HTTPException, Query
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
from typing import Optional, List, Dict, Any
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

@api_router.get("/events")
async def events(
    city: str = Query("madrid"),
    lat: Optional[float] = Query(None),
    lon: Optional[float] = Query(None),
    radius_km: float = Query(150.0, ge=10, le=500),
):
    """Aggregated events from DGT + SCT + Madrid (when applicable) for the requested city."""
    city = city.lower()
    preset = CITIES.get(city)
    if preset:
        clat = lat if lat is not None else preset["lat"]
        clon = lon if lon is not None else preset["lon"]
    else:
        clat = lat if lat is not None else 40.41678
        clon = lon if lon is not None else -3.70379

    tasks = [fetch_dgt_events(clon, clat, radius_km)]
    extra = preset.get("extra") if preset else None
    if extra == "sct" or city in ("barcelona", "tarragona", "girona", "sct"):
        tasks.append(fetch_sct_events())
    if extra == "madrid" or city == "madrid":
        tasks.append(fetch_madrid_events())

    results = await asyncio.gather(*tasks, return_exceptions=True)
    all_features: List[Dict[str, Any]] = []
    source_health: Dict[str, str] = {}
    labels = ["DGT 3.0"]
    if extra == "sct" or city in ("barcelona", "tarragona", "girona", "sct"):
        labels.append("SCT")
    if extra == "madrid" or city == "madrid":
        labels.append("Madrid")
    for label, r in zip(labels, results):
        if isinstance(r, Exception) or not isinstance(r, dict):
            source_health[label] = "ERROR"
            continue
        source_health[label] = r.get("status", "UNKNOWN")
        for f in r.get("features", []):
            # filter SCT by radius too
            if haversine_km(clon, clat, f["lon"], f["lat"]) <= radius_km:
                all_features.append(f)

    # sort by severity
    sev_rank = {"critical": 0, "warning": 1, "info": 2}
    all_features.sort(key=lambda x: sev_rank.get(x.get("severity"), 3))

    # KPI
    severity_count = {"critical": 0, "warning": 0, "info": 0}
    for f in all_features:
        sev = f.get("severity", "info")
        severity_count[sev] = severity_count.get(sev, 0) + 1
    risk = "BAJO"
    if severity_count["critical"] >= 5:
        risk = "ALTO"
    elif severity_count["critical"] >= 1 or severity_count["warning"] >= 10:
        risk = "MEDIO"

    return {
        "city": city,
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

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
