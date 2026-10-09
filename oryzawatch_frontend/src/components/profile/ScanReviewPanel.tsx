import React, { useEffect, useState } from 'react';
import API from '../../utils/api';

interface ReviewScan {
  id: number; image: string; reporter_username: string; detected_disease: string; confidence_score: number;
  variety_name: string | null; growth_stage: string; observed_on: string | null; symptom_notes: string;
  latitude: string; longitude: string;
}
const input: React.CSSProperties = { display: 'block', width: '100%', boxSizing: 'border-box', padding: 10, marginTop: 5, border: '1px solid var(--border)', borderRadius: 8 };

function ReviewCard({ scan, onReviewed }: { scan: ReviewScan; onReviewed: () => void }) {
  const [outcome, setOutcome] = useState('');
  const [method, setMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await API.patch(`diagnostics/scans/${scan.id}/verify/`, {
        verification_status: outcome === 'INCONCLUSIVE' ? 'INCONCLUSIVE' : 'VERIFIED',
        verified_disease: outcome === 'INCONCLUSIVE' ? null : outcome,
        verification_method: outcome === 'INCONCLUSIVE' ? '' : method,
        verification_notes: notes,
      });
      onReviewed();
    } catch (err: any) { setError(err.response?.data ? JSON.stringify(err.response.data) : 'Review could not be saved.'); }
    finally { setBusy(false); }
  };
  return <article style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 20, background: '#fff', display: 'grid', gap: 12 }}>
    <h3>Sample #{scan.id} · {scan.reporter_username}</h3>
    <img src={scan.image} alt={`Rice sample ${scan.id} submitted for review`} style={{ width: '100%', maxHeight: 320, objectFit: 'contain', borderRadius: 10 }} />
    <p>AI estimate: <strong>{scan.detected_disease}</strong> ({(scan.confidence_score * 100).toFixed(1)}% confidence)</p>
    <p>Variety: {scan.variety_name || 'Unknown'} · Stage: {scan.growth_stage.replace(/_/g, ' ') || 'Unknown'}<br />Inspected: {scan.observed_on || 'Unknown'} · Location: {scan.latitude}, {scan.longitude}</p>
    <p>Field notes: {scan.symptom_notes || 'None recorded'}</p>
    <form onSubmit={(e) => void save(e)} style={{ display: 'grid', gap: 12 }}>
      <label>Human review result<select required style={input} value={outcome} onChange={(e) => setOutcome(e.target.value)} disabled={busy}>
        <option value="">Select confirmed result</option><option value="HEALTHY">Healthy / disease not found in this sample</option><option value="BLB">Bacterial Leaf Blight</option><option value="BLAST">Rice Blast</option><option value="INCONCLUSIVE">Inconclusive / needs further assessment</option>
      </select></label>
      {outcome !== 'INCONCLUSIVE' && <label>Confirmation method<select required style={input} value={method} onChange={(e) => setMethod(e.target.value)} disabled={busy}><option value="">Select method</option><option value="FIELD_EXPERT">Extension worker or agronomist</option><option value="MAO_INSPECTION">MAO inspection</option><option value="LABORATORY">Laboratory confirmation</option><option value="OTHER">Other confirmation</option></select></label>}
      <label>Review notes<textarea required={outcome === 'INCONCLUSIVE'} style={input} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={busy} /></label>
      {error && <p role="alert" style={{ color: '#a32929' }}>{error}</p>}
      <button disabled={busy || !outcome} style={{ padding: 12, borderRadius: 8 }}>{busy ? 'Saving…' : 'Save human review'}</button>
    </form>
  </article>;
}

export default function ScanReviewPanel({ canExport = false }: { canExport?: boolean }) {
  const [scans, setScans] = useState<ReviewScan[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [exporting, setExporting] = useState(false);
  const download = async () => {
    setExporting(true); setError('');
    try {
      const { data } = await API.get<Blob>('diagnostics/verified-data/', { responseType: 'blob', timeout: 120000 });
      const url = URL.createObjectURL(data);
      const link = document.createElement('a'); link.href = url; link.download = 'verified_scans.csv';
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError('Verified data download failed. Please try again.'); }
    finally { setExporting(false); }
  };
  const load = async () => {
    const { data } = await API.get<ReviewScan[]>('diagnostics/review-queue/');
    setScans(data);
  };
  useEffect(() => { load().catch(() => setError('Could not load scans. Please refresh to try again.')).finally(() => setLoading(false)); }, []);
  return <section style={{ display: 'grid', gap: 20, width: '100%' }}>
    <h2>Scan review</h2>
    <p>Record a diagnosis confirmed by a field inspection, qualified reviewer, or laboratory. Mark uncertain samples inconclusive.</p>
    {canExport && <button onClick={() => void download()} disabled={exporting} style={{ padding: 12, justifySelf: 'start', borderRadius: 8 }}>{exporting ? 'Preparing download…' : 'Download verified data (CSV)'}</button>}
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    {loading && <p>Loading pending samples…</p>}
    {!loading && !error && scans.length === 0 && <p>No scans waiting for review.</p>}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
      {scans.map((scan) => <ReviewCard key={scan.id} scan={scan} onReviewed={() => {
        setScans((current) => current.filter((s) => s.id !== scan.id)); setMessage(`Human review saved for sample #${scan.id}.`);
      }} />)}
    </div>
  </section>;
}
