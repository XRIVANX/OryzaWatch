import React, { useState } from 'react';
import ThreatAssessment from '../../components/profile/ThreatAssessment';
import { TABS } from '../../data/diseasemap.data';

export const DiseaseMapView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<number>(0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top bar */}
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

      {/* Content */}
      <div className="layout-content">
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '10px' }}>
          {TABS.map((tab, i) => (
            <button
              key={i}
              onClick={() => setActiveTab(i)}
              className="btn btn-outline"
              style={{
                padding: '8px 18px',
                background: activeTab === i ? 'var(--leaf-primary)' : '#ffffff',
                borderColor: activeTab === i ? 'var(--leaf-primary)' : 'var(--border)',
                color: activeTab === i ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: activeTab === i ? 700 : 500,
              }}
            >
              {activeTab === i && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#6ee79f' }} />}
              {tab}
            </button>
          ))}
        </div>

        {/* Map + Right panel */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
          {/* Map Card */}
          <div className="glass-panel" style={{ padding: '16px', overflow: 'hidden', backgroundColor: '#ffffff' }}>
            <MapSVG />
          </div>

          {/* Right Panel */}
          <ThreatAssessment />
        </div>
      </div>
    </div>
  );
};

const MapSVG: React.FC = () => (
  <svg viewBox="0 0 560 420" style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '8px' }}>
    {/* Clean Light Botanical Map Background */}
    <rect width="560" height="420" fill="#f4f8f4" rx="8" />

    {/* Grid lines with soft sage tint */}
    {[70,140,210,280,350,420,490].map(x => <line key={x} x1={x} y1="0" x2={x} y2="420" stroke="#e0ece2" strokeWidth="0.8"/>)}
    {[60,120,180,240,300,360].map(y => <line key={y} x1="0" y1={y} x2="560" y2={y} stroke="#e0ece2" strokeWidth="0.8"/>)}

    {/* Barangay labels */}
    <text x="80"  y="28"  fontSize="9.5" fill="#527960" textAnchor="middle" fontWeight="700">Brgy. Ising</text>
    <text x="230" y="28"  fontSize="9.5" fill="#527960" textAnchor="middle" fontWeight="700">Brgy. Carmen</text>
    <text x="380" y="28"  fontSize="9.5" fill="#527960" textAnchor="middle" fontWeight="700">Brgy. Santo Nino</text>
    <text x="80"  y="230" fontSize="9.5" fill="#527960" textAnchor="middle" fontWeight="700">Brgy. Mangaon</text>
    <text x="230" y="230" fontSize="9.5" fill="#527960" textAnchor="middle" fontWeight="700">Brgy. San Pedro</text>
    <text x="380" y="230" fontSize="9.5" fill="#527960" textAnchor="middle" fontWeight="700">Brgy. Magugpo</text>

    {/* Safe farms – fresh crisp green rectangles */}
    {[
      [310, 40,50,34],[370,50,50,34],[430,50,50,34],[300,75,50,34],
      [310,170,50,34],[380,180,50,34],[430,170,50,34],
      [310,280,50,34],[370,290,50,34],[430,280,50,34],[490,170,50,34],
    ].map(([x,y,w,h],i) => (
      <rect key={i} x={x} y={y} width={w} height={h} rx="4" fill="#d1f2dc" stroke="#86d8a3" strokeWidth="1"/>
    ))}

    {/* 48h zone (dashed orange) */}
    <circle cx="130" cy="155" r="105" fill="rgba(245,158,11,0.06)" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="6,4"/>
    <text x="130" y="63" fontSize="9.5" fill="#d97706" textAnchor="middle" fontWeight="700">48h Zone</text>

    {/* 24h zone (solid red tint) */}
    <circle cx="130" cy="155" r="65" fill="rgba(239,68,68,0.08)" stroke="#f87171" strokeWidth="1.5"/>
    <text x="130" y="94" fontSize="9.5" fill="#ef4444" textAnchor="middle" fontWeight="700">24h Zone</text>

    {/* Hotspot core */}
    <circle cx="130" cy="155" r="24" fill="rgba(220,38,38,0.18)" stroke="#dc2626" strokeWidth="2"/>
    <circle cx="130" cy="155" r="10" fill="#dc2626"/>

    {/* Hotspot label */}
    <text x="130" y="170" fontSize="8.5" fill="#b91c1c" textAnchor="middle" fontWeight="800">BLB Hotspot P1</text>
    <text x="130" y="180" fontSize="7.5" fill="#b91c1c" textAnchor="middle">Brgy. Ising Center</text>

    {/* Wind arrow */}
    <g transform="translate(185,100)">
      <line x1="0" y1="0" x2="40" y2="-18" stroke="#0284c7" strokeWidth="2.5" strokeLinecap="round"/>
      <polygon points="40,-18 28,-24 32,-10" fill="#0284c7"/>
      <text x="44" y="-20" fontSize="9.5" fill="#0284c7" fontWeight="800">Wind</text>
      <text x="44" y="-10" fontSize="8.5" fill="#0369a1">12 km/h</text>
    </g>

    {/* At-risk farms near hotspot */}
    {[[55,185,44,28],[60,230,44,28],[100,230,44,28],[155,220,44,28]].map(([x,y,w,h],i) => (
      <rect key={i} x={x} y={y} width={w} height={h} rx="4" fill="#fef3c7" stroke="#fbbf24" strokeWidth="1"/>
    ))}

    {/* Compass */}
    <g transform="translate(518,40)">
      <circle cx="0" cy="0" r="18" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1"/>
      <text x="0" y="-6" fontSize="9.5" fill="#1e293b" textAnchor="middle" fontWeight="800">N</text>
      <polygon points="0,-14 -4,-2 0,2 4,-2" fill="#ef4444"/>
      <polygon points="0,14 -4,2 0,-2 4,2"  fill="#94a3b8"/>
    </g>

    {/* Scale bar */}
    <g transform="translate(40,395)">
      <line x1="0" y1="0" x2="80" y2="0" stroke="#475569" strokeWidth="2"/>
      <line x1="0" y1="-4" x2="0" y2="4" stroke="#475569" strokeWidth="1.5"/>
      <line x1="80" y1="-4" x2="80" y2="4" stroke="#475569" strokeWidth="1.5"/>
      <text x="40" y="-6" fontSize="9" fill="#475569" textAnchor="middle" fontWeight="700">5 km</text>
    </g>
  </svg>
);

export default DiseaseMapView;
