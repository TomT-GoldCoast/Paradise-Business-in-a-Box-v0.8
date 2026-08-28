const AREA_POINTS = [
  ['port st. lucie', [27.2730, -80.3582]],
  ['port st lucie', [27.2730, -80.3582]],
  ['jensen beach', [27.2545, -80.2298]],
  ['stuart', [27.1975, -80.2528]],
  ['palm city', [27.1678, -80.2662]],
  ['hobe sound', [27.0595, -80.1364]]
];

const FALLBACK_POINTS = [
  [27.3030, -80.3550], [27.2790, -80.3150], [27.2520, -80.2810],
  [27.2160, -80.2690], [27.1730, -80.2570], [27.1030, -80.1940]
];

export const mapProvider = {
  name: 'Leaflet + Esri Satellite + OpenStreetMap + OSRM',
  keyRequired: false,
  geocoder: 'Nominatim (best effort)',
  router: 'OSRM road network',
  externalProvider: 'Google Maps'
};

export function coordinatesFor(job, index = 0) {
  if (Array.isArray(job?.coords) && job.coords.length === 2) return [Number(job.coords[0]), Number(job.coords[1])];
  if (Number.isFinite(Number(job?.lat)) && Number.isFinite(Number(job?.lng))) return [Number(job.lat), Number(job.lng)];
  const text = `${job?.fullAddress || job?.address || ''} ${job?.customer || ''}`.toLowerCase();
  const area = AREA_POINTS.find(([name]) => text.includes(name));
  if (area) {
    const row = index % 4;
    return [area[1][0] + (row - 1.5) * .0042, area[1][1] + ((index % 3) - 1) * .0042];
  }
  return FALLBACK_POINTS[index % FALLBACK_POINTS.length];
}

export function installBaseLayers(map, L, defaultLayer = 'satellite') {
  const street = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'
  });
  const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19, attribution: 'Tiles &copy; Esri'
  });
  const labels = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', {
    maxZoom: 20, pane: 'overlayPane', attribution: '&copy; OpenStreetMap &copy; CARTO'
  });
  if (defaultLayer === 'street') street.addTo(map); else { satellite.addTo(map); labels.addTo(map); }
  L.control.layers({ 'Satellite / Hybrid': satellite, 'Street Map': street }, { 'Road Labels': labels }, { collapsed: true }).addTo(map);
  return { street, satellite, labels };
}

export async function roadRoute(points = []) {
  if (points.length < 2) return { geometry: points, distanceMeters: 0, durationSeconds: 0 };
  const coords = points.map(([lat,lng]) => `${lng},${lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Road routing service unavailable');
  const json = await response.json();
  const route = json.routes?.[0];
  if (!route?.geometry?.coordinates) throw new Error('No road route returned');
  return {
    geometry: route.geometry.coordinates.map(([lng,lat]) => [lat,lng]),
    distanceMeters: route.distance || 0,
    durationSeconds: route.duration || 0
  };
}

export async function optimizedTrip(points = []) {
  if (points.length < 2) return { geometry: points, order: points.map((_,i)=>i), distanceMeters: 0, durationSeconds: 0 };
  const coords = points.map(([lat,lng]) => `${lng},${lat}`).join(';');
  const url = `https://router.project-osrm.org/trip/v1/driving/${coords}?source=first&roundtrip=false&overview=full&geometries=geojson&steps=false`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Route recommendation service unavailable');
  const json = await response.json();
  const trip = json.trips?.[0];
  if (!trip?.geometry?.coordinates) throw new Error('No route recommendation returned');
  const order = (json.waypoints || []).map((w, originalIndex) => ({ originalIndex, waypointIndex: w.waypoint_index ?? originalIndex }))
    .sort((a,b) => a.waypointIndex-b.waypointIndex).map(x => x.originalIndex);
  return {
    geometry: trip.geometry.coordinates.map(([lng,lat]) => [lat,lng]),
    order,
    distanceMeters: trip.distance || 0,
    durationSeconds: trip.duration || 0
  };
}

export async function geocodeFullAddress(address) {
  if (!address || !/,/.test(address)) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q=${encodeURIComponent(address)}`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    const json = await response.json();
    const hit = json?.[0];
    if (!hit) return null;
    const lat = Number(hit.lat), lng = Number(hit.lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat,lng] : null;
  } catch { return null; }
}

export function externalRouteUrl(jobs = [], origin = '') {
  const addresses = jobs.map(job => job.fullAddress || job.address).filter(Boolean).slice(0, 9);
  if (!addresses.length) return '';
  const start = origin || addresses[0];
  const destination = addresses[addresses.length - 1];
  const waypoints = addresses.slice(1, -1).map(encodeURIComponent).join('%7C');
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(start)}&destination=${encodeURIComponent(destination)}${waypoints ? `&waypoints=${waypoints}` : ''}`;
}
