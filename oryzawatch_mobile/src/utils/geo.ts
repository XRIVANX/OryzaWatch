// Mirrors oryzawatch_frontend/src/utils/geo.ts and the backend's
// analytics/prediction.py destination_point() - kept in sync by hand since
// mobile and web don't share a package.
const EARTH_RADIUS_KM = 6371;

/** Point `distanceKm` from (lat, lng) along `bearingDeg` (0=N, 90=E). */
export function destinationPoint(lat: number, lng: number, bearingDeg: number, distanceKm: number): [number, number] {
  const lat1 = (lat * Math.PI) / 180;
  const lng1 = (lng * Math.PI) / 180;
  const brng = (bearingDeg * Math.PI) / 180;
  const dR = distanceKm / EARTH_RADIUS_KM;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(dR) + Math.cos(lat1) * Math.sin(dR) * Math.cos(brng));
  const lng2 = lng1 + Math.atan2(
    Math.sin(brng) * Math.sin(dR) * Math.cos(lat1),
    Math.cos(dR) - Math.sin(lat1) * Math.sin(lat2)
  );
  return [(lat2 * 180) / Math.PI, (lng2 * 180) / Math.PI];
}

/**
 * Weighted heat points for a "thermal" spread visualization: a hot, tight
 * cluster right at the hotspot, fanning out downwind through days 1-5 with
 * decreasing intensity and increasing lateral spread.
 */
export function buildSpreadHeatPoints(
  lat: number,
  lng: number,
  windDeg: number,
  dailyReachKm: number[]
): [number, number, number][] {
  const points: [number, number, number][] = [[lat, lng, 1]];
  dailyReachKm.forEach((reachKm, i) => {
    const day = i + 1;
    const intensity = Math.max(1 - day * 0.15, 0.2);
    const spreadDeg = Math.min(10 + day * 6, 45);
    const ringPoints = 5 + day;
    for (let j = 0; j < ringPoints; j++) {
      const frac = ringPoints === 1 ? 0.5 : j / (ringPoints - 1);
      const bearing = windDeg - spreadDeg + frac * (2 * spreadDeg);
      [0.5, 0.8, 1].forEach((depthFrac) => {
        const [pLat, pLng] = destinationPoint(lat, lng, bearing, reachKm * depthFrac);
        points.push([pLat, pLng, intensity * (0.6 + 0.4 * depthFrac)]);
      });
    }
  });
  return points;
}
