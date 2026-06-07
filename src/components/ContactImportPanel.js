import React, { useState, useEffect } from 'react';
import { readFileAsText } from '../lib/adminUpload';
import { parseContactSpreadsheet, importContacts, fetchUploadedContacts } from '../lib/contactImport';
import { fetchRepRoster } from '../lib/repCodes';
import { useTheme } from '../context/ThemeContext';
import { getAdminUi } from '../lib/theme';

const STATUS_COLORS = { imported: '#C9A84C', contacted: '#4CAF7D', converted: '#7B6CF6', archived: '#AAA' };

export default function ContactImportPanel({ userId, isAdmin = false, isSalesRep = false, defaultRepId = null }) {
  const { t } = useTheme();
  const ui = getAdminUi();
  const [contacts, setContacts] = useState([]);
  const [reps, setReps] = useState([]);
  const [assignedRepId, setAssignedRepId] = useState(defaultRepId || userId || '');
  const [preview, setPreview] = useState([]);
  const [filename, setFilename] = useState('');
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    const rows = await fetchUploadedContacts({ userId, isAdmin, isSalesRep });
    setContacts(rows);
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (isAdmin) fetchRepRoster().then(setReps);
  }, [userId, isAdmin, isSalesRep]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const text = await readFileAsText(file);
      const rows = parseContactSpreadsheet(text, file.name);
      if (!rows.length) {
        setError('No contacts found. Use CSV with headers: name, company, email, phone, address.');
        return;
      }
      setPreview(rows);
      setFilename(file.name);
    } catch (err) {
      setError(err.message || 'Could not read file.');
    }
    e.target.value = '';
  };

  const handleImport = async () => {
    if (!preview.length) return;
    setImporting(true);
    setError('');
    try {
      const result = await importContacts(preview, {
        uploadedBy: userId,
        assignedRepId: assignedRepId || userId,
        filename,
      });
      setMessage(`Imported ${result.imported} contact${result.imported === 1 ? '' : 's'}.`);
      setPreview([]);
      setFilename('');
      await load();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message || 'Import failed.');
    }
    setImporting(false);
  };

  const filtered = contacts.filter(c => {
    const q = filter.toLowerCase();
    if (!q) return true;
    return [c.name, c.company, c.email, c.phone, c.address, c.status].some(v => (v || '').toLowerCase().includes(q));
  });

  const exportCsv = () => {
    const headers = ['name', 'company', 'email', 'phone', 'address', 'account_type', 'store_type', 'status', 'notes'];
    const rows = filtered.map(c => headers.map(h => `"${(c[h] ?? '').toString().replace(/"/g, '""')}"`).join(','));
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contacts-export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const inputStyle = { ...ui.input, fontSize: 13 };

  return (
    <div style={ui.card}>
      <div style={ui.sectionLabel}>Contact import</div>
      <p style={{ fontSize: 13, color: t.textSecondary, marginBottom: '1rem', lineHeight: 1.5 }}>
        Upload a CSV spreadsheet (Excel: Save As → CSV). Columns: name, company, email, phone, address, account type, store type, notes.
      </p>

      {message && <div style={{ background: t.successBg, border: `0.5px solid ${t.successBorder}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: t.successText, marginBottom: 12 }}>{message}</div>}
      {error && <div style={{ background: t.errorBg, border: `0.5px solid ${t.errorBorder}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: t.errorText, marginBottom: 12 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ fontSize: 11, color: t.textFaint, display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Choose file</label>
          <input type="file" accept=".csv,.txt,text/csv" onChange={handleFile} style={{ fontSize: 13 }} />
        </div>
        {isAdmin && reps.length > 0 && (
          <div style={{ minWidth: 180 }}>
            <label style={{ fontSize: 11, color: t.textFaint, display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Assign to rep</label>
            <select value={assignedRepId} onChange={e => setAssignedRepId(e.target.value)} style={inputStyle}>
              <option value={userId}>Me (admin upload)</option>
              {reps.map(r => (
                <option key={r.user_id} value={r.user_id}>{r.name || r.email} ({r.rep_code})</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {preview.length > 0 && (
        <div style={{ marginBottom: '1.25rem', padding: '1rem', background: t.bgHover, borderRadius: 10, border: t.borderHairlineLight }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Preview ({preview.length} rows from {filename})</div>
          <div style={{ maxHeight: 160, overflow: 'auto', fontSize: 12, color: t.textSecondary, marginBottom: 12 }}>
            {preview.slice(0, 8).map((r, i) => (
              <div key={i} style={{ padding: '4px 0', borderBottom: `0.5px solid ${t.borderSubtle}` }}>
                {r.name || '—'} · {r.company || '—'} · {r.email || r.phone || '—'}
              </div>
            ))}
            {preview.length > 8 && <div style={{ color: t.textFaint, marginTop: 6 }}>+ {preview.length - 8} more</div>}
          </div>
          <button onClick={handleImport} disabled={importing} style={{ background: importing ? t.border : t.btnPrimaryBg, color: importing ? t.textFaint : t.btnPrimaryText, border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: importing ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {importing ? 'Importing…' : `Import ${preview.length} contacts`}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search contacts…" style={{ ...inputStyle, flex: 1, minWidth: 160 }} />
        <button onClick={exportCsv} style={{ background: t.bgElevated, border: t.borderHairline, borderRadius: 8, padding: '8px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: t.text }}>Export CSV</button>
        <button onClick={load} style={{ ...ui.tabBtn(true) }}>↻</button>
      </div>

      {loading ? (
        <div style={{ fontSize: 13, color: t.textFaint }}>Loading…</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: t.bgMuted }}>
                {['Name', 'Company', 'Email', 'Phone', 'Type', 'Status', 'Source'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, color: t.textFaint, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: t.borderHairline }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id}>
                  <td style={{ padding: '10px', borderBottom: `0.5px solid ${t.borderSubtle}`, fontWeight: 500 }}>{c.name || '—'}</td>
                  <td style={{ padding: '10px', borderBottom: `0.5px solid ${t.borderSubtle}`, color: t.textSecondary }}>{c.company || '—'}</td>
                  <td style={{ padding: '10px', borderBottom: `0.5px solid ${t.borderSubtle}`, color: t.textSecondary }}>{c.email || '—'}</td>
                  <td style={{ padding: '10px', borderBottom: `0.5px solid ${t.borderSubtle}`, color: t.textSecondary }}>{c.phone || '—'}</td>
                  <td style={{ padding: '10px', borderBottom: `0.5px solid ${t.borderSubtle}`, textTransform: 'capitalize', color: t.textSecondary }}>{c.account_type || '—'}</td>
                  <td style={{ padding: '10px', borderBottom: `0.5px solid ${t.borderSubtle}` }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: (STATUS_COLORS[c.status] || '#CCC') + '22', color: STATUS_COLORS[c.status] || t.textSecondary }}>{c.status}</span>
                  </td>
                  <td style={{ padding: '10px', borderBottom: `0.5px solid ${t.borderSubtle}`, fontSize: 11, color: t.textFaint }}>{c.source_filename || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <div style={{ padding: 24, textAlign: 'center', color: t.textFaint, fontSize: 13 }}>No contacts yet. Upload a CSV to get started.</div>}
        </div>
      )}
    </div>
  );
}
