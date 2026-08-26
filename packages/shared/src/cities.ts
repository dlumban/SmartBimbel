/**
 * Static coordinates for SmartBimbel's launch cities (PRD §1: "initial focus
 * Jabodetabek, Bandung, Surabaya, Medan, Yogyakarta"), used in place of a
 * live Google Geocoding API call - Google Maps isn't provisioned (see
 * docs/third-party-setup.md). Since the platform only launches in a known,
 * finite set of cities, a static lookup is arguably more appropriate than
 * live geocoding for MVP: it's zero-cost, has no external dependency, and
 * every supported city is guaranteed to resolve. Revisit with live
 * geocoding only if/when the platform expands beyond a curated city list.
 */
export interface CityCoordinates {
  name: string;
  lat: number;
  lng: number;
}

export const SUPPORTED_CITIES: CityCoordinates[] = [
  { name: "Jakarta Pusat", lat: -6.1805, lng: 106.8284 },
  { name: "Jakarta Selatan", lat: -6.2615, lng: 106.8106 },
  { name: "Jakarta Utara", lat: -6.1384, lng: 106.8636 },
  { name: "Jakarta Barat", lat: -6.1352, lng: 106.8133 },
  { name: "Jakarta Timur", lat: -6.2251, lng: 106.9004 },
  { name: "Bogor", lat: -6.5971, lng: 106.806 },
  { name: "Depok", lat: -6.4025, lng: 106.7942 },
  { name: "Tangerang", lat: -6.1783, lng: 106.6319 },
  { name: "Bekasi", lat: -6.2383, lng: 106.9756 },
  { name: "Bandung", lat: -6.9175, lng: 107.6191 },
  { name: "Surabaya", lat: -7.2575, lng: 112.7521 },
  { name: "Medan", lat: 3.5952, lng: 98.6722 },
  { name: "Yogyakarta", lat: -7.7956, lng: 110.3695 },
];

const byName = new Map(SUPPORTED_CITIES.map((c) => [c.name.toLowerCase(), c]));

export function getCityCoordinates(cityName: string): CityCoordinates | null {
  return byName.get(cityName.trim().toLowerCase()) ?? null;
}

/** Haversine distance in kilometers between two lat/lng points. */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}
