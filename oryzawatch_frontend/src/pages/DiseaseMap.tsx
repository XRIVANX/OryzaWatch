import React, { useState } from 'react';
import s from '../styles/diseasemap.styles.jsx';
import { TABS, LEGEND } from '../data/diseasemap.data';

const DiseaseMap: React.FC = () => {
  const [activeTab, setActiveTab] = useState<number>(0);

  return (
    <div style={s.wrapper}>
      {/* Top bar */}
      <div style={s.topbar}>
        <div>
          <div style={s.pageTitle}>Disease Spread Map</div>
          <div style={s.pageSubtitle}>Detailed Forecast &amp; Real-time Tracking</div>
        </div>
      </div>

      {/* Content */}
      <div style={s.content}>
        {/* Tabs */}
        <div style={s.tabs}>
          {TABS.map((tab, i) => (
            <button
              key={i}
              onClick={() => setActiveTab(i)}
              style={{ ...s.tab, ...(activeTab === i ? s.tabActive : {}) }}
            >
              {activeTab === i && <span style={s.tabDot} />}
              {tab}
            </button>
          ))}
        </div>

        {/* Map + Right panel */}
        <div style={s.mapRow}>
          {/* Map */}
          <div className="card" style={s.mapCard}>
            <MapSVG />
          </div>

          {/* Right panel */}
          <div style={s.rightPanel}>
            <div style={s.rpTitle}>Carmen Overview</div>
            <div style={s.rpSubtitle}>Real-time disease spread analysis</div>

            <div style={s.rpSection}>
              <div style={s.rpSectionTitle}>THREAT ASSESSMENT</div>
              <div style={s.rpRow}>
                <span style={s.rpLabel}>Primary Threat</span>
                <span style={{ ...s.rpValue, color: '#dc2626', fontWeight: 700 }}>Bacterial Leaf Blight</span>
              </div>
              <div style={s.rpRow}>
                <span style={s.rpLabel}>Severity</span>
                <span style={{ ...s.rpValue, color: '#dc2626', fontWeight: 700 }}>High (Level 4)</span>
              </div>
              <div style={s.rpRow}>
                <span style={s.rpLabel}>Spread Velocity</span>
                <span style={s.rpValue}>4.2 km / day</span>
              </div>
            </div>

            <div style={s.rpSection}>
              <div style={s.rpSectionTitle}>MAP LEGEND</div>
              <div style={s.legendList}>
                {LEGEND.map((l, i) => (
                  <div key={i} style={s.legendItem}>
                    <span style={{ ...s.legendDot, background: l.color, border: i >= 3 ? '1px solid #ccc' : 'none' }} />
                    <span style={s.legendLabel}>{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── SVG Map ────────────────────────────────────────────────────── */
const MapSVG: React.FC = () => (
  <svg viewBox="0 0 560 420" style={{ width: '100%', height: 'auto', display: 'block' }}>
    {/* Background */}
    <rect width="560" height="420" fill="#f5f8f2" rx="8" />

    {/* Grid lines */}
    {[70,140,210,280,350,420,490].map(x => <line key={x} x1={x} y1="0" x2={x} y2="420" stroke="#e0e8e0" strokeWidth="0.5"/>)}
    {[60,120,180,240,300,360].map(y => <line key={y} x1="0" y1={y} x2="560" y2={y} stroke="#e0e8e0" strokeWidth="0.5"/>)}

    {/* Barangay labels */}
    <text x="80"  y="28"  fontSize="9" fill="#aaa" textAnchor="middle">Brgy. Ising</text>
    <text x="230" y="28"  fontSize="9" fill="#aaa" textAnchor="middle">Brgy. Carmen</text>
    <text x="380" y="28"  fontSize="9" fill="#aaa" textAnchor="middle">Brgy. Santo Nino</text>
    <text x="80"  y="230" fontSize="9" fill="#aaa" textAnchor="middle">Brgy. Mangaon</text>
    <text x="230" y="230" fontSize="9" fill="#aaa" textAnchor="middle">Brgy. San Pedro</text>
    <text x="380" y="230" fontSize="9" fill="#aaa" textAnchor="middle">Brgy. Magugpo</text>

    {/* Safe farms – green rectangles */}
    {[
      [310, 40,50,34],[370,50,50,34],[430,50,50,34],[300,75,50,34],
      [310,170,50,34],[380,180,50,34],[430,170,50,34],
      [310,280,50,34],[370,290,50,34],[430,280,50,34],[490,170,50,34],
    ].map(([x,y,w,h],i) => (
      <rect key={i} x={x} y={y} width={w} height={h} rx="4" fill="#c8f0c8" stroke="#86efac" strokeWidth="1"/>
    ))}

    {/* 48h zone (dashed orange) */}
    <circle cx="130" cy="155" r="105" fill="rgba(251,191,36,0.08)" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="6,4"/>
    <text x="130" y="63" fontSize="9" fill="#d97706" textAnchor="middle">48h Zone</text>

    {/* 24h zone (solid red tint) */}
    <circle cx="130" cy="155" r="65" fill="rgba(248,113,113,0.12)" stroke="#f87171" strokeWidth="1.5"/>
    <text x="130" y="94" fontSize="9" fill="#ef4444" textAnchor="middle">24h Zone</text>

    {/* Hotspot core */}
    <circle cx="130" cy="155" r="24" fill="rgba(220,38,38,0.2)" stroke="#dc2626" strokeWidth="2"/>
    <circle cx="130" cy="155" r="10" fill="#dc2626"/>

    {/* Hotspot label */}
    <text x="130" y="170" fontSize="8.5" fill="#dc2626" textAnchor="middle" fontWeight="700">BLB Hotspot P1</text>
    <text x="130" y="180" fontSize="7.5" fill="#dc2626" textAnchor="middle">Brgy. Ising Center</text>

    {/* Wind arrow */}
    <g transform="translate(185,100)">
      <line x1="0" y1="0" x2="40" y2="-18" stroke="#1d6fa4" strokeWidth="2" strokeLinecap="round"/>
      <polygon points="40,-18 28,-24 32,-10" fill="#1d6fa4"/>
      <text x="44" y="-20" fontSize="9" fill="#1d6fa4" fontWeight="700">Wind</text>
      <text x="44" y="-10" fontSize="8" fill="#1d6fa4">12 km/h</text>
    </g>

    {/* At-risk farms near hotspot */}
    {[[55,185,44,28],[60,230,44,28],[100,230,44,28],[155,220,44,28]].map(([x,y,w,h],i) => (
      <rect key={i} x={x} y={y} width={w} height={h} rx="4" fill="#fef3c7" stroke="#fbbf24" strokeWidth="1"/>
    ))}

    {/* Compass */}
    <g transform="translate(518,40)">
      <circle cx="0" cy="0" r="18" fill="white" stroke="#ccc" strokeWidth="1"/>
      <text x="0" y="-6" fontSize="9" fill="#333" textAnchor="middle" fontWeight="700">N</text>
      <polygon points="0,-14 -4,-2 0,2 4,-2" fill="#dc2626"/>
      <polygon points="0,14 -4,2 0,-2 4,2"  fill="#aaa"/>
    </g>

    {/* Scale bar */}
    <g transform="translate(40,395)">
      <line x1="0" y1="0" x2="80" y2="0" stroke="#555" strokeWidth="2"/>
      <line x1="0" y1="-4" x2="0" y2="4" stroke="#555" strokeWidth="1.5"/>
      <line x1="80" y1="-4" x2="80" y2="4" stroke="#555" strokeWidth="1.5"/>
      <text x="40" y="-6" fontSize="9" fill="#555" textAnchor="middle">5 km</text>
    </g>
  </svg>
);

export default DiseaseMap;
