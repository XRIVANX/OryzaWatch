import React, { useState, useRef, useEffect } from 'react';
import API from '../../utils/api';
import ScanResultCard from './ScanResultCard';

interface ScanResult {
  type: 'success' | 'error';
  disease?: string;
  confidence?: string;
  probabilities?: Record<string, number> | null;
  message?: string;
}

const SCAN_STAGES = [
  '🌿 Optical Leaf Morphology Extraction...',
  '🔬 Neural Chlorosis & Lesion Pattern Analysis...',
  '📍 Spatiotemporal Micro-Climate Mapping (Carmen Corridor)...',
  '✓ Diagnostic Classification & Confidence Scoring...',
];

interface LeafScannerProps {
  onScanSuccess?: () => void;
}

export const LeafScanner: React.FC<LeafScannerProps> = ({ onScanSuccess }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview]           = useState<string | null>(null);
  const [loading, setLoading]           = useState<boolean>(false);
  const [stageIndex, setStageIndex]     = useState<number>(0);
  const [progress, setProgress]         = useState<number>(0);
  const [result, setResult]             = useState<ScanResult | null>(null);
  const [coords]                        = useState({ latitude: '7.4483', longitude: '125.8094' });
  const fileInputRef                    = useRef<HTMLInputElement>(null);

  // Animate stages during scan loading
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      setStageIndex(0);
      setProgress(15);
      let step = 0;
      interval = setInterval(() => {
        step++;
        if (step < SCAN_STAGES.length) {
          setStageIndex(step);
          setProgress((step + 1) * 24);
        }
      }, 700);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
    setResult(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      fileInputRef.current?.click();
      return;
    }
    setLoading(true);
    setResult(null);
    const formData = new FormData();
    formData.append('image', selectedFile);
    formData.append('latitude', coords.latitude);
    formData.append('longitude', coords.longitude);

    try {
      const response = await API.post('diagnostics/upload/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // Delay to let user enjoy the scanning analysis telemetry
      setTimeout(() => {
        setResult({
          type: 'success',
          disease: response.data.detected_disease,
          confidence: (response.data.confidence_score * 100).toFixed(1),
          probabilities: response.data.probabilities,
        });
        setLoading(false);
        onScanSuccess?.();
      }, 800);
    } catch (err: any) {
      setTimeout(() => {
        setResult({
          type: 'error',
          message: err.response?.data?.detail || 'Specimen diagnostic analysis failed.',
        });
        setLoading(false);
      }, 600);
    }
  };

  const resetAll = () => {
    setSelectedFile(null);
    setPreview(null);
    setResult(null);
    setProgress(0);
  };

  return (
    <div style={{ width: '100%', maxWidth: '520px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Hidden file input */}
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* Main Scanner Viewport Frame */}
      <div
        className={`scanner-card-shell ${loading ? 'glow-pulse' : ''}`}
        style={{
          border: loading ? '1.5px solid var(--leaf-bright)' : '1px solid var(--border)',
          transition: 'all 0.3s ease',
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        {/* HUD Brackets */}
        <div className="hud-corner hud-top-left" />
        <div className="hud-corner hud-top-right" />
        <div className="hud-corner hud-bottom-left" />
        <div className="hud-corner hud-bottom-right" />

        <div className="scanner-viewport">
          {!preview ? (
            /* Empty State */
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '14px',
                padding: '24px',
                textAlign: 'center',
                cursor: 'pointer',
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <div
                style={{
                  width: '68px',
                  height: '68px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #edf9f1 0%, #dcf5e5 100%)',
                  border: '1.5px solid rgba(46, 158, 89, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 14px rgba(46, 158, 89, 0.15)',
                  transition: 'transform 0.2s ease',
                }}
              >
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#237e46" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>

              <div>
                <div style={{ fontSize: '15.5px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif" }}>
                  Position Leaf in Frame
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.6 }}>
                  Ensure good lighting and keep the leaf<br />steady for the best accuracy.
                </div>
              </div>
            </div>
          ) : (
            /* Specimen Preview with Cyber-Botanical Overlays */
            <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img
                src={preview}
                alt="leaf preview"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  filter: loading ? 'brightness(0.95) contrast(1.05)' : 'none',
                  transition: 'all 0.3s ease',
                }}
              />

              {/* Laser Beam & Hologram Grid when Scanning */}
              {loading && (
                <>
                  <div className="scanner-grid" />
                  <div className="scanner-laser-line" />
                  <div className="scanner-laser-trail" />

                  {/* Pulsing Biometric Nodes */}
                  <div className="bio-node" style={{ top: '35%', left: '42%' }} />
                  <div className="bio-node" style={{ top: '58%', left: '60%', animationDelay: '0.4s' }} />
                  <div className="bio-node" style={{ top: '48%', left: '28%', animationDelay: '0.8s' }} />

                  {/* Telemetry Stage Overlay */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '14px',
                      left: '14px',
                      right: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      zIndex: 20,
                    }}
                  >
                    <div className="scanner-stage-badge">
                      <span className="shimmer-text">{SCAN_STAGES[stageIndex]}</span>
                    </div>
                    <div className="scanner-progress-bar">
                      <div className="scanner-progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Error Banner if error occurred */}
        {result?.type === 'error' && (
          <div
            style={{
              marginTop: '16px',
              padding: '12px 16px',
              background: 'var(--red-light)',
              border: '1px solid var(--red-border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--red-text)',
              fontSize: '13px',
              textAlign: 'center',
            }}
          >
            ✗ {result.message}
          </div>
        )}

        {/* Diagnostic Actions */}
        {!result?.disease && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
            <button
              onClick={handleUpload}
              disabled={loading}
              className="btn btn-leaf"
              style={{ width: '100%', padding: '12px', fontSize: '14px', fontWeight: 700 }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              {loading ? 'Analyzing Leaf Specimen...' : (selectedFile ? 'Run AI Scan' : 'Capture Photo')}
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="btn btn-outline"
              style={{ width: '100%', padding: '11px', fontSize: '13.5px' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              Upload from Gallery
            </button>
          </div>
        )}
      </div>

      {/* Result Card Reveal */}
      {result?.type === 'success' && result.disease && (
        <ScanResultCard
          disease={result.disease}
          confidence={result.confidence || '90.0'}
          probabilities={result.probabilities}
          onReset={resetAll}
        />
      )}
    </div>
  );
};

export default LeafScanner;
