// Mirrors farms/models.py -> polygon_area_hectares(): an equirectangular
// projection centered on the polygon, then the shoelace formula. Good enough
// at single-farm scale; the server recomputes the authoritative value.
const EARTH_RADIUS_KM = 6371;

export function polygonAreaHectares(points: [number, number][]): number {
  if (!points || points.length < 3) return 0;

  const lat0 = points.reduce((sum, p) => sum + p[0], 0) / points.length;
  const lat0Rad = (lat0 * Math.PI) / 180;
  const kmPerDegLat = (Math.PI / 180) * EARTH_RADIUS_KM;
  const kmPerDegLng = (Math.PI / 180) * EARTH_RADIUS_KM * Math.cos(lat0Rad);

  const xy = points.map(([lat, lng]) => [lng * kmPerDegLng, lat * kmPerDegLat]);

  let areaKm2 = 0;
  for (let i = 0; i < xy.length; i++) {
    const [x1, y1] = xy[i];
    const [x2, y2] = xy[(i + 1) % xy.length];
    areaKm2 += x1 * y2 - x2 * y1;
  }
  areaKm2 = Math.abs(areaKm2) / 2;

  return Math.round(areaKm2 * 100 * 10000) / 10000; // km^2 -> hectares
}

/** Point `distanceKm` from (lat, lng) along `bearingDeg` (0=N, 90=E). Mirrors
 * the backend's analytics/prediction.py destination_point(). */
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
 * decreasing intensity and increasing lateral spread - the closest a
 * hand-rolled heatmap gets to a real gaussian plume without a physics sim.
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
    const spreadDeg = Math.min(10 + day * 6, 45); // wider cone as it travels further
    const ringPoints = 5 + day;
    for (let j = 0; j < ringPoints; j++) {
      const frac = ringPoints === 1 ? 0.5 : j / (ringPoints - 1);
      const bearing = windDeg - spreadDeg + frac * (2 * spreadDeg);
      // A couple of points along each bearing (not just the outer edge) so
      // the whole wedge fills in, not just its rim.
      [0.5, 0.8, 1].forEach((depthFrac) => {
        const [pLat, pLng] = destinationPoint(lat, lng, bearing, reachKm * depthFrac);
        points.push([pLat, pLng, intensity * (0.6 + 0.4 * depthFrac)]);
      });
    }
  });
  return points;
}
