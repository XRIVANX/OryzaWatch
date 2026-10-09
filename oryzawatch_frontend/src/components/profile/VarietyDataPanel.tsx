import React, { useEffect, useState } from 'react';
import API from '../../utils/api';

interface Evidence {
  id: number; disease: string; disease_label: string; response: string; response_label: string;
  evidence_type: string; source: string; notes: string;
}
interface Variety {
  id: number; name: string; alternate_names: string; maturity_days: number | null;
  source: string; description: string; is_active: boolean; disease_evidence: Evidence[];
}
const EMPTY_VARIETY = { name: '', alternate_names: '', maturity_days: '', source: '', description: '', is_active: true };
const EMPTY_EVIDENCE = { disease: 'BLB', response: 'TOLERANT', evidence_type: 'FIELD_OBSERVATION', source: '', notes: '' };
const box: React.CSSProperties = { background: '#fff', padding: 20, border: '1px solid var(--border)', borderRadius: 14 };
const input: React.CSSProperties = { display: 'block', width: '100%', boxSizing: 'border-box', padding: 10, marginTop: 5, border: '1px solid var(--border)', borderRadius: 8 };
const button: React.CSSProperties = { padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer' };

export default function VarietyDataPanel() {
  const [varieties, setVarieties] = useState<Variety[]>([]);
  const [varietyForm, setVarietyForm] = useState(EMPTY_VARIETY);
  const [editVariety, setEditVariety] = useState<number | null>(null);
  const [evidenceVariety, setEvidenceVariety] = useState('');
  const [evidenceForm, setEvidenceForm] = useState(EMPTY_EVIDENCE);
  const [editEvidence, setEditEvidence] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    const { data } = await API.get<Variety[]>('diagnostics/varieties/?include_inactive=1');
    setVarieties(data);
  };
  useEffect(() => { load().catch(() => setError('Could not load varieties. Please refresh to try again.')).finally(() => setLoading(false)); }, []);

  const save = async (event: React.FormEvent, kind: 'variety' | 'evidence') => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      if (kind === 'variety') {
        const payload = { ...varietyForm, maturity_days: varietyForm.maturity_days === '' ? null : Number(varietyForm.maturity_days) };
        if (editVariety) await API.patch(`diagnostics/varieties/${editVariety}/`, payload);
        else await API.post('diagnostics/varieties/', payload);
        setEditVariety(null); setVarietyForm(EMPTY_VARIETY);
      } else {
        if (editEvidence) await API.patch(`diagnostics/variety-evidence/${editEvidence}/`, evidenceForm);
        else await API.post(`diagnostics/varieties/${evidenceVariety}/evidence/`, evidenceForm);
        setEditEvidence(null); setEvidenceForm(EMPTY_EVIDENCE);
      }
      await load(); setMessage('Saved successfully.');
    } catch (err: any) {
      setError(err.response?.data ? JSON.stringify(err.response.data) : 'Save failed. Please try again.');
    } finally { setBusy(false); }
  };

  const startEditVariety = (variety: Variety) => {
    setEditVariety(variety.id);
    setVarietyForm({ name: variety.name, alternate_names: variety.alternate_names,
      maturity_days: variety.maturity_days == null ? '' : String(variety.maturity_days),
      source: variety.source, description: variety.description, is_active: variety.is_active });
  };

  return <section style={{ display: 'grid', gap: 20, width: '100%' }}>
    <div><h2>Rice varieties</h2><p>Add varieties as you obtain data. Add a disease rating only when you have a source; no rating means unknown.</p></div>
    {error && <p role="alert" style={{ color: '#a32929' }}>{error}</p>}
    {message && <p role="status" style={{ color: '#237e46' }}>{message}</p>}
    {loading && <p>Loading variety records…</p>}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
      <form onSubmit={(e) => void save(e, 'variety')} style={{ ...box, display: 'grid', gap: 12 }}>
        <h3>{editVariety ? 'Edit variety' : 'Add variety'}</h3>
        <label>Name<input required maxLength={120} style={input} value={varietyForm.name} onChange={(e) => setVarietyForm({ ...varietyForm, name: e.target.value })} /></label>
        <label>Other names (optional)<input maxLength={255} style={input} value={varietyForm.alternate_names} onChange={(e) => setVarietyForm({ ...varietyForm, alternate_names: e.target.value })} /></label>
        <label>Maturity in days (optional)<input type="number" min={1} max={32767} style={input} value={varietyForm.maturity_days} onChange={(e) => setVarietyForm({ ...varietyForm, maturity_days: e.target.value })} /></label>
        <label>Source (optional)<input maxLength={255} style={input} value={varietyForm.source} onChange={(e) => setVarietyForm({ ...varietyForm, source: e.target.value })} /></label>
        <label>Description (optional)<textarea style={input} value={varietyForm.description} onChange={(e) => setVarietyForm({ ...varietyForm, description: e.target.value })} /></label>
        <label><input type="checkbox" checked={varietyForm.is_active} onChange={(e) => setVarietyForm({ ...varietyForm, is_active: e.target.checked })} /> Available for new scans</label>
        <button style={button} disabled={busy || loading}>{busy ? 'Saving…' : 'Save variety'}</button>
        {editVariety && <button type="button" style={button} onClick={() => { setEditVariety(null); setVarietyForm(EMPTY_VARIETY); }}>Cancel edit</button>}
      </form>
      <form onSubmit={(e) => void save(e, 'evidence')} style={{ ...box, display: 'grid', gap: 12 }}>
        <h3>{editEvidence ? 'Edit disease evidence' : 'Add disease evidence'}</h3>
        <label>Variety<select required disabled={editEvidence != null} style={input} value={evidenceVariety} onChange={(e) => setEvidenceVariety(e.target.value)}><option value="">Choose a variety</option>{varieties.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
        <label>Disease<select style={input} value={evidenceForm.disease} onChange={(e) => setEvidenceForm({ ...evidenceForm, disease: e.target.value })}><option value="BLB">Bacterial Leaf Blight</option><option value="BLAST">Rice Blast</option></select></label>
        <label>Reported response<select style={input} value={evidenceForm.response} onChange={(e) => setEvidenceForm({ ...evidenceForm, response: e.target.value })}><option value="TOLERANT">Tolerant</option><option value="RESISTANT">Resistant</option><option value="MODERATELY_RESISTANT">Moderately resistant</option><option value="SUSCEPTIBLE">Susceptible</option></select></label>
        <label>Evidence type<select style={input} value={evidenceForm.evidence_type} onChange={(e) => setEvidenceForm({ ...evidenceForm, evidence_type: e.target.value })}><option value="FIELD_OBSERVATION">Field observation</option><option value="PUBLISHED_RESEARCH">Published research</option><option value="CONTROLLED_TRIAL">Controlled trial</option><option value="OTHER">Other source</option></select></label>
        <label>Source or report reference<input required maxLength={255} style={input} value={evidenceForm.source} onChange={(e) => setEvidenceForm({ ...evidenceForm, source: e.target.value })} /></label>
        <label>Conditions and notes<textarea style={input} value={evidenceForm.notes} onChange={(e) => setEvidenceForm({ ...evidenceForm, notes: e.target.value })} placeholder="Location, season, plant age, or study conditions" /></label>
        <button style={button} disabled={busy || !evidenceVariety || loading}>{busy ? 'Saving…' : 'Save evidence'}</button>
        {editEvidence && <button type="button" style={button} onClick={() => { setEditEvidence(null); setEvidenceForm(EMPTY_EVIDENCE); }}>Cancel edit</button>}
      </form>
    </div>
    {!loading && varieties.length === 0 && <p>No varieties added yet. Start with a name; add tolerance evidence when it becomes available.</p>}
    {varieties.map((v) => <article key={v.id} style={box}>
      <h3>{v.name} {!v.is_active && <small>(Unavailable for new scans)</small>}</h3>
      <p>{v.description || 'No description added.'}</p><button style={button} onClick={() => startEditVariety(v)} disabled={busy}>Edit variety</button>
      {v.disease_evidence.length === 0 && <p>Disease response: unknown — no evidence recorded.</p>}
      {v.disease_evidence.map((evidence) => <div key={evidence.id} style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12 }}>
        <strong>{evidence.disease_label}: {evidence.response_label}</strong><p>Source: {evidence.source}</p><p>{evidence.notes}</p>
        <button style={button} disabled={busy} onClick={() => {
          setEvidenceVariety(String(v.id)); setEditEvidence(evidence.id);
          setEvidenceForm({ disease: evidence.disease, response: evidence.response, evidence_type: evidence.evidence_type, source: evidence.source, notes: evidence.notes });
        }}>Edit evidence</button>
      </div>)}
    </article>)}
  </section>;
}
