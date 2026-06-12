import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API, timeout: 30000 });

export const fetchEvents = (city, lat, lon, radius_km = 150) =>
  api.get("/events", { params: { city, lat, lon, radius_km } }).then((r) => r.data);

export const fetchParking = (lat, lon, radius = 1500) =>
  api.get("/parking", { params: { lat, lon, radius } }).then((r) => r.data);

export const fetchCities = () => api.get("/cities").then((r) => r.data);

export const fetchHealth = () => api.get("/health").then((r) => r.data);

export const geocode = (q) => api.get("/geocode", { params: { q } }).then((r) => r.data);

export const fetchRoute = (from_q, to_q, mode = "car") =>
  api.get("/route", { params: { from: from_q, to: to_q, mode } }).then((r) => r.data);
