import React, { useState, useEffect } from 'react';
import { readFileAsText } from '../lib/adminUpload';
import { parseContactSpreadsheet, importContacts, fetchUploadedContacts } from '../lib/contactImport';
import { fetchRepRoster } from '../lib/repCodes';
import { transferUploadedContact, bulkTransferUploadedContacts, saveUploadedContactNotes, repDisplayName, buildRepOptions } from '../lib/customerTransfer';
import BulkTransferBar from './BulkTransferBar';
import StaffNotesCell from './StaffNotesCell';
import { useTheme } from '../context/ThemeContext';
import { getAdminUi } from '../lib/theme';
import { whatsAppUrl } from '../lib/whatsapp';

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
  const [transferringId, setTransferringId] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selected, setSelected] = useState(() => new Set());

  const repOptions = buildRepOptions(reps);
  const repNameById = Object.fromEntries(repOptions.map(r => [r.user_id, repDisplayName(r)]));

  const load = async () => {
    setLoading(true);
    setSelected(new Set());
    const rows = await fetchUploadedContacts({ userId, isAdmin, isSalesRep });
    setContacts(rows);
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (isAdmin || isSalesRep) fetchRepRoster().then(setReps);
  }, [userId, isAdmin, isSalesRep]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTransferContact = async (contactId, newRepUserId, contactName) => {
    const targetLabel = newRepUserId
      ? repDisplayName(repOptions.find(r => r.user_id === newRepUserId))
      : 'Unassigned';
    if (!window.confirm(`Transfer ${contactName || 'this contact'} to ${targetLabel}?`)) return;

    setTransferringId(contactId);
    setError('');
    const result = await transferUploadedContact(contactId, newRepUserId || null);
    if (!result.ok) {
      setError(result.error || 'Transfer failed.');
    } else {
      setMessage('Contact transferred.');
      await load();
      setTimeout(() => setMessage(''), 3000);
    }
    setTransferringId(null);
  };

  const handleBulkTransfer = async (newRepUserId) => {
    const ids = [...selected];
    if (!ids.length) return;
    const targetLabel = newRepUserId
      ? repDisplayName(repOptions.find(r => r.user_id === newRepUserId))
      : 'Unassigned';
    if (!window.confirm(`Transfer ${ids.length} contact(s) to ${targetLabel}?`)) return;

    setBulkBusy(true);
    setError('');
    const result = await bulkTransferUploadedContacts(ids, newRepUserId || null);
    if (!result.ok) {
      setError(result.error || 'Bulk transfer failed.');
    } else {
      setMessage(`Transferred ${result.count} contact(s).`);
      await load();
      setTimeout(() => setMessage(''), 3000);
    }
    setBulkBusy(false);
  };

  const handleSaveContactNotes = async (contactId, notes) => {
    const result = await saveUploadedContactNotes(contactId, notes);
    if (result.ok) {
      setContacts(prev => prev.map(c => (c.id === contactId ? { ...c, notes: notes || '' } : c)));
    } else {
      setError(result.error || 'Could not save notes.');
    }
    return result.ok;
  };

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
    return [c.name, c.company, c.email, c.phone, c.address, c.status, c.notes].some(v => (v || '').toLowerCase().includes(q));
  });

  const filteredIds = filtered.map(c => c.id);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every(id => selected.has(id));
  const canBulk = isAdmin || isSalesRep;

  const toggleSelect = (contactId) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allFilteredSelected) filteredIds.forEach(id => next.delete(id));
      else filteredIds.forEach(id => next.add(id));
      return next;
    });
  };

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

      {canBulk && (
        <BulkTransferBar
          selectedCount={selected.size}
          repOptions={repOptions}
          onTransfer={handleBulkTransfer}
          onClear={() => setSelected(new Set())}
          busy={bulkBusy}
        />
      )}

      {loading ? (
        <div style={{ fontSize: 13, color: t.textFaint }}>Loading…</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: t.bgMuted }}>
                {canBulk && (
                  <th style={{ padding: '8px 10px', borderBottom: t.borderHairline, width: 36 }}>
                    <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAllFiltered} aria-label="Select all contacts" />
                  </th>
                )}
                {['Name', 'Company', 'Email', 'Phone', 'Type', 'Status', 'Staff notes', 'Assigned to', 'Source'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, color: t.textFaint, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: t.borderHairline }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id}>
                  {canBulk && (
                    <td style={{ padding: '10px', borderBottom: `0.5px solid ${t.borderSubtle}` }}>
                      <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} aria-label={`Select ${c.name || c.company}`} />
                    </td>
                  )}
                  <td style={{ padding: '10px', borderBottom: `0.5px solid ${t.borderSubtle}`, fontWeight: 500 }}>{c.name || '—'}</td>
                  <td style={{ padding: '10px', borderBottom: `0.5px solid ${t.borderSubtle}`, color: t.textSecondary }}>{c.company || '—'}</td>
                  <td style={{ padding: '10px', borderBottom: `0.5px solid ${t.borderSubtle}`, color: t.textSecondary }}>{c.email || '—'}</td>
                  <td style={{ padding: '10px', borderBottom: `0.5px solid ${t.borderSubtle}`, color: t.textSecondary }}>
                    {c.phone ? (
                      <>
                        {c.phone}
                        {whatsAppUrl(c.phone) && (
                          <>
                            {' · '}
                            <a href={whatsAppUrl(c.phone)} target="_blank" rel="noreferrer" style={{ color: t.accent, textDecoration: 'none', fontWeight: 600 }}>WhatsApp</a>
                          </>
                        )}
                      </>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '10px', borderBottom: `0.5px solid ${t.borderSubtle}`, textTransform: 'capitalize', color: t.textSecondary }}>{c.account_type || '—'}</td>
                  <td style={{ padding: '10px', borderBottom: `0.5px solid ${t.borderSubtle}` }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: (STATUS_COLORS[c.status] || '#CCC') + '22', color: STATUS_COLORS[c.status] || t.textSecondary }}>{c.status}</span>
                    {c.linked_user_id && (
                      <div style={{ fontSize: 10, color: t.successText, marginTop: 4 }}>Signed up</div>
                    )}
                  </td>
                  <td style={{ padding: '10px', borderBottom: `0.5px solid ${t.borderSubtle}`, verticalAlign: 'top' }}>
                    <StaffNotesCell
                      value={c.notes}
                      onSave={(notes) => handleSaveContactNotes(c.id, notes)}
                      placeholder="Notes about this contact…"
                    />
                  </td>
                  <td style={{ padding: '10px', borderBottom: `0.5px solid ${t.borderSubtle}`, minWidth: 150 }}>
                    {(isAdmin || isSalesRep) && repOptions.length > 0 ? (
                      <select
                        value={c.assigned_rep_id || ''}
                        disabled={transferringId === c.id || bulkBusy}
                        onChange={(e) => handleTransferContact(c.id, e.target.value || null, c.name || c.company)}
                        style={{ ...inputStyle, fontSize: 12, padding: '6px 8px', width: '100%', cursor: transferringId === c.id ? 'wait' : 'pointer' }}
                      >
                        <option value="">Unassigned</option>
                        {repOptions.map(r => (
                          <option key={r.user_id} value={r.user_id}>
                            {repDisplayName(r)}{r.rep_code ? ` (${r.rep_code})` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span style={{ fontSize: 12, color: t.textSecondary }}>{repNameById[c.assigned_rep_id] || '—'}</span>
                    )}
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
