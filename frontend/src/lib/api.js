import axios from "axios";

const API = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || "http://localhost:3001",
  timeout: 10000,
});

// Events (traffic incidents, works, congestion, etc.)
export const fetchEvents = async (cityId) => {
  const { data } = await API.get(`/events/${cityId}`);
  return data;
};

// Health check for data sources
export const fetchHealth = async () => {
  const { data } = await API.get("/health");
  return data;
};

// Parking availability (OSM Overpass)
export const fetchParking = async (lat, lng, radius) => {
  const { data } = await API.get("/parking", { params: { lat, lng, radius } });
  return data;
};

// Cities list
export const fetchCities = async () => {
  const { data } = await API.get("/cities");
  return data;
};

// Geocoding (address to coords)
export const geocode = async (query) => {
  const { data } = await API.get("/geocode", { params: { q: query } });
  return data;
};

// Route optimization (OSRM)
export const fetchRoute = async (from, to, mode = "car") => {
  const { data } = await API.get("/route", { params: { from, to, mode } });
  return data;
};

// Azure tile URL generator
export const azureTileUrl = (kind) => {
  const key = process.env.REACT_APP_AZURE_MAPS_KEY;
  const tileset = {
    flow: "Microsoft.Maps.trafficFlow",
    incident: "Microsoft.Maps.trafficIncident",
    weather: "Microsoft.Maps.weather",
    satellite: "Microsoft.Maps.satellite"
  }[kind] || "Microsoft.Maps.trafficFlow";
  return `https://atlas.microsoft.com/map/tile/png?api-version=2&tileset=${tileset}&zoom={z}&x={x}&y={y}&subscription-key=${key}`;
};

// Mobility stations (bike-share, scooters)
export const fetchMobilityStations = async (lat, lng, radius) => {
  const { data } = await API.get("/mobility", { params: { lat, lng, radius } });
  return data;
};

// Multimodal route planning
export const fetchMultimodalPlan = async (fromLat, fromLon, toLat, toLon) => {
  const { data } = await API.get("/multimodal", {
    params: { from_lat: fromLat, from_lon: fromLon, to_lat: toLat, to_lon: toLon }
  });
  return data;
};

export default API;