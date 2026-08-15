import { useState } from 'react';
import type { CSSProperties, ChangeEvent, FormEvent } from 'react';
import API from '../../utils/api';
import TextInput from '../auth/TextInput';

interface DiagnosticUploadProps {
  onUploadSuccess?: () => void;
}

interface Coords {
  latitude: string;
  longitude: string;
}

interface Message {
  type: 'success' | 'error';
  text: string;
}

interface DiagnosticResponse {
  detected_disease: string;
  confidence_score: number;
}

export const DiagnosticUpload = ({ onUploadSuccess }: DiagnosticUploadProps) => {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [preview, setPreview]             = useState<string | null>(null);
  const [coords, setCoords]               = useState<Coords>({ latitude: '7.4483', longitude: '125.8094' });
  const [loading, setLoading]             = useState<boolean>(false);
  const [message, setMessage]             = useState<Message | null>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      setPreview(URL.createObjectURL(file));
      setMessage(null);
    }
  };

  const handleCoordsChange = (e: ChangeEvent<HTMLInputElement>) => {
    setCoords((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedImage) {
      alert('Please select a leaf profile picture first.');
      return;
    }

    setLoading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append('image',     selectedImage);
    formData.append('latitude',  coords.latitude);
    formData.append('longitude', coords.longitude);

    try {
      const response = await API.post<DiagnosticResponse>('diagnostics/upload/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setMessage({
        type: 'success',
        text: `Scan Complete! Condition detected: ${response.data.detected_disease} (Confidence: ${(response.data.confidence_score * 100).toFixed(1)}%)`,
      });

      onUploadSuccess?.();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setMessage({
        type: 'error',
        text: e.response?.data?.detail || 'Upload submission execution failed.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '28px', maxWidth: '520px', margin: '0 auto' }}>
      <h3 style={{ margin: '0 0 6px 0', color: 'var(--leaf-bright)', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>🌿</span> AI Leaf Diagnostics Engine
      </h3>
      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 20px 0' }}>
        Upload rice crop specimens for instant health processing
      </p>

      {message && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-sm)',
            color: '#fff',
            fontSize: '13.5px',
            marginBottom: '18px',
            fontWeight: 500,
            background: message.type === 'success' ? 'var(--green-status-light)' : 'var(--red-light)',
            border: `1px solid ${message.type === 'success' ? 'var(--green-status-border)' : 'var(--red-border)'}`,
          }}
        >
          {message.type === 'success' ? '✓ ' : '✗ '} {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500, display: 'block', marginBottom: '6px' }}>
            Crop Leaf Image <span style={{ color: 'var(--leaf-bright)' }}>*</span>
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              backgroundColor: 'rgba(10, 24, 16, 0.7)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        {preview && (
          <div style={{ marginBottom: '16px', textAlign: 'center' }}>
            <img src={preview} alt="Preview" style={{ maxHeight: '160px', borderRadius: '8px', margin: '0 auto' }} />
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <TextInput
            label="Latitude Coordinate"
            name="latitude"
            value={coords.latitude}
            onChange={handleCoordsChange}
          />
          <TextInput
            label="Longitude Coordinate"
            name="longitude"
            value={coords.longitude}
            onChange={handleCoordsChange}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn btn-leaf"
          style={{ width: '100%', padding: '12px', fontSize: '14px', marginTop: '8px' }}
        >
          {loading ? 'Processing ML Diagnostics...' : 'Submit Diagnostic Request'}
        </button>
      </form>
    </div>
  );
};

export default DiagnosticUpload;