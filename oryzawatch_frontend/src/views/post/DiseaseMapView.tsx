import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import ThreatAssessment from '../../components/profile/ThreatAssessment';
import { FIELD_AREAS, FieldAreaKey } from '../../data/diseasemap.data';

interface LeafletMap {
  setView(center: [number, number], zoom: number): LeafletMap;
  remove(): void;
}

interface LeafletLayer {
  addTo(map: LeafletMap): LeafletLayer;
  bindPopup(content: string): LeafletLayer;
}

interface LeafletApi {
  map(element: HTMLDivElement): LeafletMap;
  tileLayer(url: string, options: { attribution: string; maxZoom: number }): LeafletLayer;
  polygon(points: [number, number][], options: Record<string, string | number>): LeafletLayer;
  circle(center: [number, number], options: Record<string, string | number>): LeafletLayer;
  marker(center: [number, number]): LeafletLayer;
}

declare global {
  interface Window {
    L?: LeafletApi;
  }
}

const loadLeaflet = (): Promise<LeafletApi> => Promise.resolve(L as unknown as LeafletApi);

const RiceFieldMap: React.FC<{ area: FieldAreaKey }> = ({ area }) => {
  const mapElement = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isDisposed = false;
    let map: LeafletMap | undefined;
    const field = FIELD_AREAS[area];

    loadLeaflet().then((leaflet) => {
      if (isDisposed || !mapElement.current) return;

      map = leaflet.map(mapElement.current).setView(field.center, 14);
      leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      const fieldOffsets: [number, number][][] = [
        [[0.0028, -0.0035], [0.0028, -0.0008], [0.0009, -0.0008], [0.0009, -0.0035]],
        [[0.0017, 0.0002], [0.0017, 0.0034], [-0.0003, 0.0034], [-0.0003, 0.0002]],
        [[-0.0011, -0.0030], [-0.0011, -0.0004], [-0.0030, -0.0004], [-0.0030, -0.0030]],
        [[-0.0020, 0.0006], [-0.0020, 0.0032], [-0.0040, 0.0032], [-0.0040, 0.0006]],
      ];
      fieldOffsets.forEach((offsets, index) => {
        const coordinates = offsets.map(([latitude, longitude]) => [field.center[0] + latitude, field.center[1] + longitude] as [number, number]);
        leaflet.polygon(coordinates, { color: '#3f9b5f', fillColor: '#86efac', fillOpacity: 0.45, weight: 2 })
          .addTo(map as LeafletMap)
          .bindPopup(`${field.fieldName} ${index + 1} — Low risk`);
      });

      leaflet.circle(field.hotspot, { color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.22, radius: 450, weight: 2 })
        .addTo(map)
        .bindPopup(`<strong>BLB Hotspot</strong><br>${field.fieldName}`);
      leaflet.circle(field.hotspot, { color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.08, radius: 900, weight: 2, dashArray: '6 6' })
        .addTo(map)
        .bindPopup('48-hour forecast zone');
      leaflet.marker(field.hotspot).addTo(map).bindPopup(`<strong>${field.fieldName}</strong><br>Confirmed hotspot`);
    }).catch(() => {
      if (mapElement.current) mapElement.current.textContent = 'Map could not be loaded. Please check your internet connection.';
    });

    return () => {
      isDisposed = true;
      map?.remove();
    };
  }, [area]);

  return <div ref={mapElement} className="rice-field-map" aria-label={`${FIELD_AREAS[area].fieldName} map`} />;
};

export const DiseaseMapView: React.FC = () => {
  const activeArea: FieldAreaKey = 'asuncion';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header className="layout-topbar">
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif" }}>
            Disease Spread Map
          </h1>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🗺️</span>
            <span>Detailed Forecast &amp; Real-time Tracking</span>
          </div>
        </div>
      </header>

      <div className="layout-content">
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
          <div className="glass-panel" style={{ padding: '16px', overflow: 'hidden', backgroundColor: '#ffffff' }}>
            <RiceFieldMap area={activeArea} />
          </div>
          <ThreatAssessment area={activeArea} />
        </div>
      </div>
    </div>
  );
};

export default DiseaseMapView;
