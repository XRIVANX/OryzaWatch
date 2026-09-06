import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { farmApi } from '../../utils/api';
import { polygonAreaHectares } from '../../utils/geo';
import type { Farm } from '../../types';

interface FarmBoundaryEditorProps {
  farm: Farm | null;         // existing farm to view/correct
  farmerLabel: string;       // display name for the header, e.g. "@jdelacruz"
  onClose: () => void;
  onSaved: (farm: Farm) => void;
}

const DEFAULT_CENTER: [number, number] = [7.45, 125.6];

/**
 * Kagawad/MAO Admin view of a single farmer's farm: shows the pin + drawn
 * boundary, and lets them redraw/correct it (field-visit corrections, or
 * filling one in for a farmer without app access). Same tap-to-draw
 * interaction as the mobile onboarding screen, reimplemented with the real
 * `leaflet` package instead of a WebView.
 */
export const FarmBoundaryEditor: React.FC<FarmBoundaryEditorProps> = ({ farm, farmerLabel, onClose, onSaved }) => {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pinRef = useRef<L.Marker | null>(null);
  const lineRef = useRef<L.Polyline | null>(null);
  const polygonRef = useRef<L.Polygon | null>(null);
  const pointMarkersRef = useRef<L.CircleMarker[]>([]);
  const pointsRef = useRef<[number, number][]>([]);
  const drawingRef = useRef(false);

  const [drawing, setDrawing] = useState(false);
  const [pointCount, setPointCount] = useState(0);
  const [boundary, setBoundary] = useState<[number, number][] | null>(farm?.boundary ?? null);
  const [hectares, setHectares] = useState(farm ? String(farm.size_hectares) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapElement.current) return;
    const center: [number, number] = farm
      ? [parseFloat(farm.latitude), parseFloat(farm.longitude)]
      : DEFAULT_CENTER;

    const map = L.map(mapElement.current).setView(center, farm ? 17 : 12);
    mapRef.current = map;
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Esri World Imagery',
    }).addTo(map);

    const pinIcon = L.divIcon({
      className: 'farm-pin',
      html: '<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;background:#237e46;border:3px solid white;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>',
      iconSize: [26, 26],
      iconAnchor: [13, 26],
    });
    const pin = L.marker(center, { icon: pinIcon, draggable: true }).addTo(map);
    pinRef.current = pin;

    if (farm?.boundary && farm.boundary.length >= 3) {
      polygonRef.current = L.polygon(farm.boundary, {
        color: '#237e46', weight: 3, fillColor: '#4ade80', fillOpacity: 0.45,
      }).addTo(map);
      pointsRef.current = farm.boundary;
    }

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (drawingRef.current) {
        const pt: [number, number] = [e.latlng.lat, e.latlng.lng];
        pointsRef.current.push(pt);
        const cm = L.circleMarker(e.latlng, { radius: 5, color: '#237e46', fillColor: '#ffffff', fillOpacity: 1, weight: 2 }).addTo(map);
        pointMarkersRef.current.push(cm);
        redrawLine();
        setPointCount(pointsRef.current.length);
      } else {
        pin.setLatLng(e.latlng);
      }
    });

    function redrawLine() {
      if (lineRef.current) {
        map.removeLayer(lineRef.current);
        lineRef.current = null;
      }
      if (pointsRef.current.length > 1) {
        lineRef.current = L.polyline(pointsRef.current, { color: '#237e46', weight: 3, dashArray: '6 6' }).addTo(map);
      }
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleDrawing = () => {
    const next = !drawing;
    drawingRef.current = next;
    setDrawing(next);
  };

  const undoPoint = () => {
    const map = mapRef.current;
    if (!map || !pointsRef.current.length) return;
    pointsRef.current.pop();
    const m = pointMarkersRef.current.pop();
    if (m) map.removeLayer(m);
    if (lineRef.current) {
      map.removeLayer(lineRef.current);
      lineRef.current = null;
    }
    if (pointsRef.current.length > 1) {
      lineRef.current = L.polyline(pointsRef.current, { color: '#237e46', weight: 3, dashArray: '6 6' }).addTo(map);
    }
    setPointCount(pointsRef.current.length);
  };

  const redraw = () => {
    const map = mapRef.current;
    if (!map) return;
    pointMarkersRef.current.forEach((m) => map.removeLayer(m));
    pointMarkersRef.current = [];
    if (lineRef.current) { map.removeLayer(lineRef.current); lineRef.current = null; }
    if (polygonRef.current) { map.removeLayer(polygonRef.current); polygonRef.current = null; }
    pointsRef.current = [];
    setPointCount(0);
    setBoundary(null);
    drawingRef.current = true;
    setDrawing(true);
  };

  const closeShape = () => {
    const map = mapRef.current;
    if (!map || pointsRef.current.length < 3) return;
    if (lineRef.current) { map.removeLayer(lineRef.current); lineRef.current = null; }
    if (polygonRef.current) { map.removeLayer(polygonRef.current); }
    polygonRef.current = L.polygon(pointsRef.current, {
      color: '#237e46', weight: 3, fillColor: '#4ade80', fillOpacity: 0.45,
    }).addTo(map);
    const pts = [...pointsRef.current];
    setBoundary(pts);
    setHectares(polygonAreaHectares(pts).toFixed(2));
    drawingRef.current = false;
    setDrawing(false);
  };

  const isClosed = boundary !== null && boundary.length >= 3;
  const hectaresValue = parseFloat(hectares);
  const canSave = !!pinRef.current && isClosed && hectaresValue > 0 && !saving;

  const handleSave = async () => {
    if (!pinRef.current || !boundary) return;
    setSaving(true);
    setError(null);
    try {
      const pos = pinRef.current.getLatLng();
      let saved: Farm;
      if (farm) {
        const res = await farmApi.update(farm.id, {
          latitude: pos.lat.toFixed(6),
          longitude: pos.lng.toFixed(6),
          boundary,
          size_hectares: hectaresValue,
        });
        saved = res.data;
      } else {
        throw new Error('This farmer has no farm record to correct yet.');
      }
      onSaved(saved);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>Farm Boundary</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{farmerLabel}</div>
          </div>
          <button className="btn btn-outline" onClick={onClose} style={{ padding: '6px 12px', fontSize: '12px' }}>Close</button>
        </div>

        {!farm ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
            This farmer hasn't set up their farm yet. They'll be prompted to do so on their next login to the mobile app.
          </div>
        ) : (
          <>
            <div ref={mapElement} style={{ height: '360px', width: '100%' }} />
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {error && (
                <div style={{ padding: '10px 14px', background: 'var(--red-light)', border: '1px solid var(--red-border)', borderRadius: 'var(--radius-sm)', color: 'var(--red-text)', fontSize: '12.5px' }}>
                  ⚠️ {error}
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-outline"
                  onClick={toggleDrawing}
                  style={{ padding: '8px 14px', fontSize: '12.5px', background: drawing ? 'var(--leaf-primary)' : '#fff', color: drawing ? '#fff' : 'var(--text-secondary)' }}
                >
                  {drawing ? 'Drawing… (tap map)' : 'Redraw Boundary'}
                </button>
                {drawing && pointCount > 0 && (
                  <button className="btn btn-outline" onClick={undoPoint} style={{ padding: '8px 12px', fontSize: '12.5px' }}>Undo Point</button>
                )}
                {drawing && pointCount >= 3 && (
                  <button className="btn btn-leaf" onClick={closeShape} style={{ padding: '8px 14px', fontSize: '12.5px' }}>Close Shape</button>
                )}
                {!drawing && isClosed && (
                  <button className="btn btn-outline" onClick={redraw} style={{ padding: '8px 12px', fontSize: '12.5px' }}>Start Over</button>
                )}
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Drag the pin to correct the exact location.</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Size (hectares)</label>
                <input
                  type="number"
                  step="0.01"
                  value={hectares}
                  onChange={(e) => setHectares(e.target.value)}
                  style={{ width: '100px', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '13px' }}
                />
              </div>

              <button
                className="btn btn-leaf"
                onClick={handleSave}
                disabled={!canSave}
                style={{ padding: '10px 16px', fontSize: '13.5px', opacity: canSave ? 1 : 0.5 }}
              >
                {saving ? 'Saving…' : 'Save Farm Boundary'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(12, 30, 20, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: '16px',
  width: 'min(640px, 92vw)',
  maxHeight: '90vh',
  overflow: 'auto',
  boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
};

export default FarmBoundaryEditor;
