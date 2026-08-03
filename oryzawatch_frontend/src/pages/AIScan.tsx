import React, { useState, useRef } from 'react';
import API from '../services/api';
import s from '../styles/aiscan.styles';
import { RECENT_SCANS } from '../data/aiscan.data';

interface ScanResult {
  type: 'success' | 'error';
  disease?: string;
  confidence?: string;
  message?: string;
}

const AIScan: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview]           = useState<string | null>(null);
  const [loading, setLoading]           = useState<boolean>(false);
  const [result, setResult]             = useState<ScanResult | null>(null);
  const [coords]                        = useState({ latitude: '7.4483', longitude: '125.8094' });
  const fileInputRef                    = useRef<HTMLInputElement>(null);

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
      setResult({
        type: 'success',
        disease: response.data.detected_disease,
        confidence: (response.data.confidence_score * 100).toFixed(1),
      });
    } catch (err: any) {
      setResult({ type: 'error', message: err.response?.data?.detail || 'Upload failed.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.wrapper}>
      {/* Top bar */}
      <div style={s.topbar}>
        <div>
          <div style={s.pageTitle}>AI Leaf Scan</div>
          <div style={s.pageSubtitle}>Disease detection via machine learning</div>
        </div>
      </div>

      {/* Content */}
      <div style={s.content}>
        {/* Upload card */}
        <div style={s.uploadOuter}>
          <div style={s.uploadCard}>
            {/* Hidden file input */}
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            {!preview ? (
              /* Empty state */
              <div style={s.emptyState}>
                <div style={s.cameraCircle}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                </div>
                <div style={s.emptyTitle}>Position Leaf in Frame</div>
                <div style={s.emptySubtitle}>Ensure good lighting and keep the leaf<br/>steady for the best accuracy.</div>
              </div>
            ) : (
              /* Preview */
              <div style={s.previewBox}>
                <img src={preview} alt="leaf preview" style={s.previewImg} />
              </div>
            )}

            {/* Result banner */}
            {result && (
              <div style={{
                ...s.resultBanner,
                background: result.type === 'success' ? 'var(--green-status-light)' : 'var(--red-light)',
                borderColor: result.type === 'success' ? 'var(--green-status-border)' : 'var(--red-border)',
                color: result.type === 'success' ? 'var(--green-status)' : 'var(--red)',
              }}>
                {result.type === 'success'
                  ? `✓ ${result.disease} detected — ${result.confidence}% confidence`
                  : `✗ ${result.message}`}
              </div>
            )}

            {/* Buttons */}
            <button
              onClick={handleUpload}
              disabled={loading}
              style={s.captureBtn}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              {loading ? 'Processing…' : (selectedFile ? 'Run AI Scan' : 'Capture Photo')}
            </button>

            <button onClick={() => fileInputRef.current?.click()} style={s.galleryBtn}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              Upload from Gallery
            </button>
          </div>
        </div>

        {/* Recent Scans */}
        <div style={s.recentSection}>
          <div style={s.sectionLabel}>RECENT SCANS</div>
          <div className="card" style={s.scanList}>
            {RECENT_SCANS.map((scan, i) => (
              <div key={i} style={{ ...s.scanItem, borderBottom: i < RECENT_SCANS.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                <div style={s.scanIcon}>{scan.icon}</div>
                <div style={s.scanInfo}>
                  <div style={s.scanDisease}>{scan.disease}</div>
                  <div style={s.scanLocation}>{scan.location} · {scan.daysAgo}</div>
                </div>
                <div style={s.scanConfidence}>{scan.confidence}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIScan;
