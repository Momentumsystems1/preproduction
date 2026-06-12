"""Backend tests for Multi-modal Trip Planner /api/multimodal/plan."""
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


# --- Multimodal plan ---
class TestMultimodalPlan:
    """Validate the Multi-modal route planner endpoint."""

    def test_plan_madrid_pozuelo_to_center(self, client):
        params = {"from_lat": 40.50, "from_lon": -3.80,
                  "to_lat": 40.4168, "to_lon": -3.7038}
        r = client.get(f"{API}/multimodal/plan", params=params, timeout=120)
        assert r.status_code == 200, r.text
        d = r.json()

        # Structure
        assert "options" in d and isinstance(d["options"], list)
        assert "parkings_considered" in d
        assert "generated_at" in d

        # Min acceptable: car direct + 100% transit (>= 2 options).
        # Preferred: 4 options.
        opts = d["options"]
        assert len(opts) >= 2, f"Expected at least 2 options, got {len(opts)}"

        # Each option must have required keys
        for o in opts:
            for k in ("label", "segments", "total_duration_min",
                      "total_distance_km", "color", "delta_vs_car_min"):
                assert k in o, f"Missing key {k} in option {o.get('label')}"
            assert isinstance(o["segments"], list) and o["segments"]
            for s in o["segments"]:
                assert "mode" in s and s["mode"] in ("car", "foot", "transit", "bike")
                assert "duration_min" in s
                assert "distance_m" in s
                assert "label" in s

        # Ordering: ascending by total_duration_min
        durations = [o["total_duration_min"] for o in opts]
        assert durations == sorted(durations), f"Options not sorted asc: {durations}"

        # Best flag on first
        assert opts[0].get("best") is True
        # Other options should not have best=True
        for o in opts[1:]:
            assert not o.get("best"), f"Non-first option marked best: {o['label']}"

    def test_plan_has_parkings_when_destination_is_madrid_center(self, client):
        params = {"from_lat": 40.50, "from_lon": -3.80,
                  "to_lat": 40.4168, "to_lon": -3.7038}
        r = client.get(f"{API}/multimodal/plan", params=params, timeout=120)
        assert r.status_code == 200
        d = r.json()
        # Madrid Sol area should have several parkings via Azure POI fuzzy.
        parkings = d.get("parkings_considered", [])
        assert isinstance(parkings, list)
        # Should have at least one parking near destination
        assert len(parkings) >= 1, "Expected at least 1 parking near Madrid center"
        p = parkings[0]
        for k in ("name", "lat", "lon"):
            assert k in p, f"Missing {k} in parking entry"

    def test_plan_prefers_4_options_for_madrid(self, client):
        """When parkings are found, we expect 4 options: car, car+walk, car+transit, transit."""
        params = {"from_lat": 40.50, "from_lon": -3.80,
                  "to_lat": 40.4168, "to_lon": -3.7038}
        r = client.get(f"{API}/multimodal/plan", params=params, timeout=120)
        d = r.json()
        labels = [o["label"] for o in d["options"]]
        assert any("DIRECTO" in l for l in labels), f"Missing car direct option: {labels}"
        assert any("TRANSPORTE PÚBLICO" in l for l in labels), f"Missing 100% transit option: {labels}"

    def test_delta_vs_car_baseline(self, client):
        params = {"from_lat": 40.50, "from_lon": -3.80,
                  "to_lat": 40.4168, "to_lon": -3.7038}
        r = client.get(f"{API}/multimodal/plan", params=params, timeout=120)
        d = r.json()
        opts = d["options"]
        car = next((o for o in opts if "DIRECTO" in o["label"]), None)
        if car:
            # delta_vs_car_min for the car option itself must be 0
            assert abs(car["delta_vs_car_min"]) < 0.05, f"car delta != 0: {car['delta_vs_car_min']}"
