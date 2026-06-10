"""Backend tests for Momentum Road Command Center."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://pro-transform-2.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Accept": "application/json"})
    return s


# --- Root & Cities ---
class TestBasic:
    def test_root(self, client):
        r = client.get(f"{API}/", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d.get("status") == "online"

    def test_cities(self, client):
        r = client.get(f"{API}/cities", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d, list)
        assert len(d) == 10
        ids = {c["id"] for c in d}
        for required in ("madrid", "barcelona", "valencia", "sevilla", "bilbao"):
            assert required in ids
        sample = d[0]
        assert "lat" in sample and "lon" in sample and "name" in sample


# --- Health ---
class TestHealth:
    def test_health(self, client):
        r = client.get(f"{API}/health", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d.get("service") == "online"
        s = d.get("sources", {})
        assert "DGT 3.0" in s and "SCT" in s and "Madrid" in s and "OSM" in s


# --- Events ---
class TestEvents:
    def test_events_madrid(self, client):
        r = client.get(f"{API}/events", params={"city": "madrid"}, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert d["city"] == "madrid"
        assert "features" in d and isinstance(d["features"], list)
        assert "sources" in d
        assert "DGT 3.0" in d["sources"]
        assert "Madrid" in d["sources"]
        # count should usually be > 0 (real-time). Verify structure if present.
        if d["features"]:
            f = d["features"][0]
            for k in ("kind", "severity", "lat", "lon", "source", "id"):
                assert k in f, f"Missing key {k} in event feature"

    def test_events_barcelona(self, client):
        r = client.get(f"{API}/events", params={"city": "barcelona"}, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert d["city"] == "barcelona"
        assert "SCT" in d["sources"]
        assert "DGT 3.0" in d["sources"]

    def test_events_invalid_city_falls_back(self, client):
        # Backend gracefully defaults invalid city to Madrid center
        r = client.get(f"{API}/events", params={"city": "atlantis"}, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert "features" in d
        assert d.get("center", {}).get("lat") is not None


# --- Parking ---
class TestParking:
    def test_parking_madrid(self, client):
        r = client.get(f"{API}/parking",
                       params={"lat": 40.4168, "lon": -3.7038, "radius": 1500},
                       timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert "features" in d
        assert isinstance(d["features"], list)
        # OSM Overpass may rate limit — accept empty but key must exist
        if d["features"]:
            p = d["features"][0]
            assert "lat" in p and "lon" in p and "name" in p
            assert p.get("source") == "OpenStreetMap"


# --- Geocode ---
class TestGeocode:
    def test_geocode_plaza_mayor(self, client):
        r = client.get(f"{API}/geocode", params={"q": "Plaza Mayor Madrid"}, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "lat" in d and "lon" in d
        assert 40.0 < float(d["lat"]) < 41.0
        assert -4.0 < float(d["lon"]) < -3.0

    def test_geocode_not_found(self, client):
        r = client.get(f"{API}/geocode",
                       params={"q": "zzzzzzzzz_no_such_place_xyz_qqq"},
                       timeout=30)
        assert r.status_code in (404, 200)
