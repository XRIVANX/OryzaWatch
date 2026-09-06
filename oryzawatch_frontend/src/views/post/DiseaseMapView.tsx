import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import ThreatAssessment from '../../components/profile/ThreatAssessment';
import FarmBoundaryEditor from '../../components/profile/FarmBoundaryEditor';
import WeatherWidget from '../../components/feed/WeatherWidget';
import { farmApi, analyticsApi } from '../../utils/api';
import { destinationPoint } from '../../utils/geo';
import type { Farm, DiseaseHotspot, HotspotStatus } from '../../types';

// Which forecast days get a labelled distance ring in Heat Map Mode.
const REFERENCE_DAYS = [1, 3, 5];

const STATUS_COLOR: Record<string, string> = {
  CRITICAL: '#dc2626',
  AT_RISK: '#f97316',
  MONITORING: '#2563eb',
  RESOLVED: '#6b7280',
};

const STATUS_OPTIONS: { value: HotspotStatus; label: string }[] = [
  { value: 'CRITICAL', label: 'Critical Outbreak' },
  { value: 'AT_RISK', label: 'At Risk' },
  { value: 'MONITORING', label: 'Monitoring' },
  { value: 'RESOLVED', label: 'Safe / Resolved' },
];

const DEFAULT_CENTER: [number, number] = [7.45, 125.6]; // Davao del Norte fallback

// Fixed tabs regardless of what data exists yet, per the MAO's request to
// always be able to switch between the whole map and either municipality.
const TABS: { key: string; label: string }[] = [
  { key: 'ALL', label: 'Whole Map' },
  { key: 'ASUNCION', label: 'Asuncion' },
  { key: 'CARMEN', label: 'Carmen' },
];

// A raw-Leaflet popup is just an HTML string, so a button inside it can't
// call a React prop directly - it calls this single global instead, which
// the mounted map effect keeps pointed at the current handlers. Only one
// DiseaseMapView is ever mounted at a time in this SPA.
declare global {
  interface Window {
    __owMapEditFarm?: (farmId: number) => void;
    __owMapManageHotspot?: (hotspotId: number) => void;
  }
}

export interface HeatMapCone {
  lat: number;
  lng: number;
  windDeg: number;
  dailyReachKm: number[];
}

// Wind-direction arrow animation (Heat Map Mode): injected once into the
// document, since Leaflet marker HTML is just a plain string and can't carry
// its own <style>. The outer element is rotated to point downwind; the inner
// one flows forward along its own (rotated) X axis, so the arrow keeps
// "streaming" toward the spread without disturbing the rotation.
const WIND_ARROW_STYLE_ID = 'ow-wind-arrow-style';
function ensureWindArrowStyle() {
  if (document.getElementById(WIND_ARROW_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = WIND_ARROW_STYLE_ID;
  style.textContent = `
    .ow-wind-arrow-inner {
      font-size: 28px;
      color: #f97316;
      text-shadow: 0 1px 4px rgba(0,0,0,0.45);
      animation: ow-wind-flow 1.1s ease-in-out infinite;
    }
    @keyframes ow-wind-flow {
      0%   { transform: translateX(-6px); opacity: 0.4; }
      50%  { transform: translateX(8px);  opacity: 1; }
      100% { transform: translateX(-6px); opacity: 0.4; }
    }
  `;
  document.head.appendChild(style);
}

// Soft radial-gradient "brushes" for the heat plume: each blob is opaque-ish
// at its centre and fully transparent at its rim, so many overlapping blobs
// blend into one smooth gaussian-looking signature (the leaflet.heat look,
// but as plain SVG that actually renders). Injected once, off-screen, and
// referenced from circle fills as url(#owHeat<n>).
const HEAT_GRAD_ID = 'ow-heat-gradients';
const HEAT_STOPS: [string, string][] = [
  ['owHeat0', '#2563eb'],
  ['owHeat1', '#22c55e'],
  ['owHeat2', '#eab308'],
  ['owHeat3', '#f97316'],
  ['owHeat4', '#dc2626'],
];
function ensureHeatGradients() {
  if (document.getElementById(HEAT_GRAD_ID)) return;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('id', HEAT_GRAD_ID);
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.position = 'absolute';
  HEAT_STOPS.forEach(([id, color]) => {
    const grad = document.createElementNS(ns, 'radialGradient');
    grad.setAttribute('id', id);
    const inner = document.createElementNS(ns, 'stop');
    inner.setAttribute('offset', '0%');
    inner.setAttribute('stop-color', color);
    inner.setAttribute('stop-opacity', '0.42');
    const outer = document.createElementNS(ns, 'stop');
    outer.setAttribute('offset', '100%');
    outer.setAttribute('stop-color', color);
    outer.setAttribute('stop-opacity', '0');
    grad.appendChild(inner);
    grad.appendChild(outer);
    svg.appendChild(grad);
  });
  document.body.appendChild(svg);
}
const heatGradId = (t: number): string =>
  t >= 0.8 ? 'owHeat4' : t >= 0.6 ? 'owHeat3' : t >= 0.4 ? 'owHeat2' : t >= 0.2 ? 'owHeat1' : 'owHeat0';

interface RiceFieldMapProps {
  farms: Farm[];
  hotspots: DiseaseHotspot[];
  focusHotspotId?: number | null;
  cones: HeatMapCone[];
  onEditFarm: (farm: Farm) => void;
  onManageHotspot: (hotspot: DiseaseHotspot) => void;
}

const RiceFieldMap: React.FC<RiceFieldMapProps> = ({ farms, hotspots, focusHotspotId, cones, onEditFarm, onManageHotspot }) => {
  const mapElement = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.__owMapEditFarm = (farmId: number) => {
      const farm = farms.find((f) => f.id === farmId);
      if (farm) onEditFarm(farm);
    };
    window.__owMapManageHotspot = (hotspotId: number) => {
      const hotspot = hotspots.find((h) => h.id === hotspotId);
      if (hotspot) onManageHotspot(hotspot);
    };
    return () => {
      delete window.__owMapEditFarm;
      delete window.__owMapManageHotspot;
    };
  }, [farms, hotspots, onEditFarm, onManageHotspot]);

  useEffect(() => {
    if (!mapElement.current) return;
    ensureWindArrowStyle();
    ensureHeatGradients();

    const map = L.map(mapElement.current).setView(DEFAULT_CENTER, 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);
    // Heat Map Mode: gray out the base map so only the colored heat
    // signature and markers stand out, matching a weather-radar overlay.
    const tilePane = map.getPane('tilePane');
    if (tilePane) {
      tilePane.style.filter = cones.length > 0 ? 'grayscale(0.95) brightness(0.96) contrast(0.92)' : '';
    }


    const farmPinIcon = L.divIcon({
      className: 'farm-pin',
      html: '<div style="width:24px;height:24px;border-radius:50% 50% 50% 0;background:#237e46;border:3px solid white;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 24],
    });

    const boundsPoints: [number, number][] = [];
    let focusMarker: L.Layer | null = null;

    farms.forEach((farm) => {
      const lat = parseFloat(farm.latitude);
      const lng = parseFloat(farm.longitude);
      boundsPoints.push([lat, lng]);
      const popup =
        `<div style="min-width:150px;">` +
        `<strong>${farm.farmer_username}</strong><br>Brgy. ${farm.barangay}<br>${farm.size_hectares.toFixed(2)} ha` +
        `<br><button onclick="window.__owMapEditFarm && window.__owMapEditFarm(${farm.id})" ` +
        `style="margin-top:8px;padding:4px 10px;font-size:12px;border-radius:6px;border:1px solid #3f9b5f;background:#fff;color:#237e46;cursor:pointer;">` +
        `✏️ Edit Location</button></div>`;

      if (farm.boundary && farm.boundary.length >= 3) {
        L.polygon(farm.boundary, { color: '#3f9b5f', fillColor: '#86efac', fillOpacity: 0.45, weight: 2 })
          .addTo(map)
          .bindPopup(popup);
      }

      // The pin + a name label are always shown, whether or not a boundary
      // has been drawn, so the farmer is identifiable at a glance.
      L.marker([lat, lng], { icon: farmPinIcon })
        .addTo(map)
        .bindPopup(popup)
        .bindTooltip(farm.farmer_username, {
          permanent: true,
          direction: 'top',
          offset: [0, -22],
          className: 'farm-name-label',
        });
    });

    // Heat Map Mode, per hotspot:
    //  1. a smooth thermal plume of the projected downwind spread - a field
    //     of soft radial-gradient "brush" circles, dense and hot at the
    //     source, thinning and cooling as it fans downwind, that blend into
    //     one continuous gaussian-looking signature;
    //  2. dashed distance rings at the reference forecast days, each labelled
    //     with how far the spread reaches by then;
    //  3. an animated arrow streaming the way the wind is carrying it.
    // All kept visually separate from the solid hotspot circle drawn below,
    // which marks the outbreak's current actual extent, not the forecast.
    // (Replaces leaflet.heat, whose canvas never paints under a bundled +
    // StrictMode setup.)
    const addHeatBrush = (lat: number, lng: number, t: number, radius: number) => {
      L.circleMarker([lat, lng], {
        stroke: false,
        fill: true,
        fillColor: `url(#${heatGradId(t)})`,
        fillOpacity: 1,
        radius,
        interactive: false,
      }).addTo(map);
    };

    cones.forEach((cone) => {
      const maxReach = Math.max(...cone.dailyReachKm, 0.2);

      // Sweep the downwind wedge: rings of samples from the source outward,
      // the fan widening and cooling with distance, each edge softened so the
      // plume feathers off rather than ending in a hard line.
      const distSteps = 20;
      const arcSteps = 7;
      for (let d = 0; d <= distSteps; d++) {
        const distFrac = d / distSteps;
        const distKm = maxReach * distFrac;
        const coreHeat = Math.max(1 - distFrac * 1.05, 0);
        const halfAngle = 5 + distFrac * 30;
        const brushRadius = 40 - distFrac * 12;
        for (let a = -arcSteps; a <= arcSteps; a++) {
          const across = a / arcSteps;
          const [pLat, pLng] = destinationPoint(cone.lat, cone.lng, cone.windDeg + across * halfAngle, distKm);
          addHeatBrush(pLat, pLng, coreHeat * (1 - 0.55 * Math.abs(across)), brushRadius);
        }
      }
      // Extra-hot, tight core right on the source.
      addHeatBrush(cone.lat, cone.lng, 1, 30);
      addHeatBrush(cone.lat, cone.lng, 1, 52);

      // Distance rings for the forecast horizon, labelled at their downwind edge.
      REFERENCE_DAYS.forEach((day) => {
        const reachKm = cone.dailyReachKm[day - 1];
        if (!reachKm) return;
        const ringPoints: [number, number][] = [];
        for (let deg = 0; deg <= 360; deg += 12) {
          ringPoints.push(destinationPoint(cone.lat, cone.lng, deg, reachKm));
        }
        L.polygon(ringPoints, { color: '#1f2937', weight: 1.5, fill: false, dashArray: '3 5', opacity: 0.55, interactive: false })
          .addTo(map);

        const [labelLat, labelLng] = destinationPoint(cone.lat, cone.lng, cone.windDeg, reachKm);
        L.marker([labelLat, labelLng], {
          interactive: false,
          icon: L.divIcon({
            className: 'ow-day-front-label',
            html: `<div style="white-space:nowrap;font:700 11px/1 'Outfit',sans-serif;color:#1f2937;background:rgba(255,255,255,0.85);border:1px solid #1f2937;border-radius:6px;padding:2px 6px;box-shadow:0 1px 3px rgba(0,0,0,0.2);">Day ${day} · ${reachKm.toFixed(1)} km</div>`,
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          }),
        }).addTo(map);
      });

      // Animated wind-heading arrow at the source.
      L.marker([cone.lat, cone.lng], {
        interactive: false,
        icon: L.divIcon({
          className: 'ow-wind-arrow',
          html: `<div style="transform: rotate(${cone.windDeg - 90}deg);"><div class="ow-wind-arrow-inner">➤</div></div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        }),
      }).addTo(map);
    });

    hotspots.forEach((hotspot) => {
      const lat = parseFloat(hotspot.latitude);
      const lng = parseFloat(hotspot.longitude);
      boundsPoints.push([lat, lng]);
      const color = STATUS_COLOR[hotspot.status] ?? '#6b7280';
      const popupHtml =
        `<div style="min-width:170px;">` +
        `<strong>${hotspot.scan.detected_disease}</strong><br>` +
        `${hotspot.status}<br>` +
        `💨 ${hotspot.wind_cardinal} ${hotspot.wind_speed.toFixed(0)} km/h<br>` +
        `💧 ${hotspot.humidity.toFixed(0)}% humidity<br>` +
        `📍 ${hotspot.spread_velocity.toFixed(1)} km/day spread` +
        `<br><button onclick="window.__owMapManageHotspot && window.__owMapManageHotspot(${hotspot.id})" ` +
        `style="margin-top:8px;padding:4px 10px;font-size:12px;border-radius:6px;border:1px solid ${color};background:#fff;color:${color};cursor:pointer;">` +
        `⚙️ Manage Status</button></div>`;

      L.circle([lat, lng], { color, fillColor: color, fillOpacity: 0.22, radius: 450, weight: 2 })
        .addTo(map)
        .bindPopup(popupHtml);
      const marker = L.marker([lat, lng]).addTo(map).bindPopup(popupHtml);
      if (hotspot.id === focusHotspotId) {
        focusMarker = marker;
      }
    });

    if (focusMarker) {
      const m = focusMarker as L.Marker;
      map.setView(m.getLatLng(), 16);
      m.openPopup();
    } else if (boundsPoints.length === 1) {
      map.setView(boundsPoints[0], 15);
    } else if (boundsPoints.length > 1) {
      map.fitBounds(L.latLngBounds(boundsPoints), { padding: [40, 40], maxZoom: 15 });
    }

    return () => {
      map.remove();
    };
  }, [farms, hotspots, focusHotspotId, cones]);

  return <div ref={mapElement} className="rice-field-map" aria-label="Farm and disease hotspot map" />;
};

interface DiseaseMapViewProps {
  focusHotspotId?: number | null;
}

export const DiseaseMapView: React.FC<DiseaseMapViewProps> = ({ focusHotspotId }) => {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [hotspots, setHotspots] = useState<DiseaseHotspot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [editingFarm, setEditingFarm] = useState<Farm | null>(null);
  const [managingHotspot, setManagingHotspot] = useState<DiseaseHotspot | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [heatMapMode, setHeatMapMode] = useState(false);
  const [cones, setCones] = useState<HeatMapCone[]>([]);
  const [predicting, setPredicting] = useState(false);

  const fetchData = () => {
    setLoading(true);
    setError(null);
    return Promise.all([farmApi.list(), analyticsApi.getHotspots()])
      .then(([farmRes, hotspotRes]) => {
        setFarms(farmRes.data);
        setHotspots(hotspotRes.data);
      })
      .catch(() => {
        setError('Unable to load farms and hotspots. Please check your connection or login session.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    let cancelled = false;
    fetchData().then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Jump straight to "Whole Map" whenever an alert asks to focus a specific
  // hotspot, so a municipality filter never hides the one being pointed at.
  useEffect(() => {
    if (focusHotspotId) setActiveTab('ALL');
  }, [focusHotspotId]);

  // A scan doesn't carry the reporter's municipality/barangay directly — look
  // it up via the matching Farm (joined by reporter username) so hotspots can
  // be filtered onto the right municipality tab.
  const farmsByUsername = useMemo(() => {
    const map = new Map<string, Farm>();
    farms.forEach((f) => map.set(f.farmer_username, f));
    return map;
  }, [farms]);

  const visibleFarms = useMemo(
    () => (activeTab === 'ALL' ? farms : farms.filter((f) => f.municipality === activeTab)),
    [farms, activeTab]
  );

  const visibleHotspots = useMemo(
    () =>
      hotspots.filter((h) => {
        if (activeTab === 'ALL') return true;
        const farm = farmsByUsername.get(h.scan.reporter_username);
        return farm?.municipality === activeTab;
      }),
    [hotspots, farmsByUsername, activeTab]
  );

  const toggleHeatMap = async () => {
    if (heatMapMode) {
      setHeatMapMode(false);
      setCones([]);
      return;
    }
    if (!visibleHotspots.length) {
      window.alert('There are no active outbreaks to predict spread for right now.');
      return;
    }
    setPredicting(true);
    try {
      const results = await Promise.all(visibleHotspots.map((h) => analyticsApi.predict(h.id)));
      setCones(
        results.map((r, i) => ({
          lat: parseFloat(visibleHotspots[i].latitude),
          lng: parseFloat(visibleHotspots[i].longitude),
          windDeg: r.data.wind_direction_deg,
          dailyReachKm: r.data.daily_reach_km,
        }))
      );
      setHeatMapMode(true);
    } catch (err: any) {
      window.alert(err?.response?.data?.detail ?? 'Prediction failed. Please try again.');
    } finally {
      setPredicting(false);
    }
  };

  const handleStatusChange = async (statusValue: HotspotStatus) => {
    if (!managingHotspot) return;
    setStatusSaving(true);
    setStatusError(null);
    try {
      const res = await analyticsApi.updateStatus(managingHotspot.id, statusValue);
      setHotspots((prev) => prev.map((h) => (h.id === res.data.id ? res.data : h)));
      setManagingHotspot(res.data);
    } catch (err: any) {
      setStatusError(err?.response?.data?.detail ?? 'Could not update status.');
    } finally {
      setStatusSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header className="layout-topbar">
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif" }}>
            Disease Spread Map
          </h1>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🗺️</span>
            <span>Real-time registered farms &amp; outbreak tracking</span>
          </div>
        </div>
      </header>

      <div className="layout-content">
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="btn btn-outline"
                style={{
                  padding: '8px 18px',
                  background: activeTab === tab.key ? 'var(--leaf-primary)' : '#ffffff',
                  borderColor: activeTab === tab.key ? 'var(--leaf-primary)' : 'var(--border)',
                  color: activeTab === tab.key ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: activeTab === tab.key ? 700 : 500,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            onClick={toggleHeatMap}
            disabled={predicting}
            className="btn btn-outline"
            style={{
              padding: '8px 18px',
              background: heatMapMode ? '#f97316' : '#ffffff',
              borderColor: '#f97316',
              color: heatMapMode ? '#ffffff' : '#f97316',
              fontWeight: 700,
            }}
          >
            🌬️ {predicting ? 'Predicting…' : heatMapMode ? 'Heat Map: ON' : 'Heat Map Mode'}
          </button>
        </div>

        {error && (
          <div style={{ padding: '12px 16px', background: 'var(--red-light)', border: '1px solid var(--red-border)', borderRadius: 'var(--radius-sm)', color: 'var(--red-text)', fontSize: '13px' }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
          <div className="glass-panel" style={{ padding: '16px', overflow: 'hidden', backgroundColor: '#ffffff', minHeight: '420px' }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '13px' }}>
                Loading real farm and hotspot data…
              </div>
            ) : farms.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '8px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '32px' }}>🌾</div>
                <p style={{ fontSize: '13px', textAlign: 'center', maxWidth: '320px' }}>
                  No farms have been registered yet. Once farmers set up their farm location in the mobile app, they'll appear here.
                </p>
              </div>
            ) : (
              <RiceFieldMap
                farms={visibleFarms}
                hotspots={visibleHotspots}
                focusHotspotId={focusHotspotId}
                cones={heatMapMode ? cones : []}
                onEditFarm={setEditingFarm}
                onManageHotspot={(h) => { setManagingHotspot(h); setStatusError(null); }}
              />
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <WeatherWidget municipality={activeTab === 'ALL' ? 'ASUNCION' : activeTab} />
            <ThreatAssessment
              municipality={TABS.find((t) => t.key === activeTab)?.label ?? 'Whole Map'}
              farms={visibleFarms}
              hotspots={visibleHotspots}
            />
          </div>
        </div>
      </div>

      {editingFarm && (
        <FarmBoundaryEditor
          farm={editingFarm}
          farmerLabel={`@${editingFarm.farmer_username}`}
          onClose={() => setEditingFarm(null)}
          onSaved={(saved) => {
            setFarms((prev) => prev.map((f) => (f.id === saved.id ? saved : f)));
            setEditingFarm(null);
          }}
        />
      )}

      {managingHotspot && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(12,30,20,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setManagingHotspot(null)}
        >
          <div
            className="glass-panel"
            style={{ background: '#ffffff', borderRadius: '16px', padding: '24px', width: 'min(420px, 90vw)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '15px', fontWeight: 800, marginBottom: '4px', color: 'var(--text-primary)' }}>
              {managingHotspot.scan.detected_disease} — reported by {managingHotspot.scan.reporter_username}
            </h3>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Current status: <strong>{STATUS_OPTIONS.find((s) => s.value === managingHotspot.status)?.label}</strong>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className="btn btn-outline"
                  disabled={statusSaving || managingHotspot.status === opt.value}
                  onClick={() => handleStatusChange(opt.value)}
                  style={{
                    padding: '10px 14px',
                    fontSize: '13px',
                    textAlign: 'left',
                    background: managingHotspot.status === opt.value ? 'var(--leaf-primary)' : '#ffffff',
                    color: managingHotspot.status === opt.value ? '#ffffff' : 'var(--text-primary)',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {statusError && (
              <p style={{ fontSize: '12.5px', color: 'var(--red-text)', marginTop: '12px' }}>{statusError}</p>
            )}
            {managingHotspot.status === 'RESOLVED' && (
              <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '10px' }}>
                Marked Safe / Resolved hotspots are removed from the active list automatically.
              </p>
            )}
            <button
              className="btn btn-outline"
              style={{ marginTop: '16px', padding: '8px 14px', fontSize: '12.5px', width: '100%' }}
              onClick={() => setManagingHotspot(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiseaseMapView;
