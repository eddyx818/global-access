import React, { useCallback, useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { getAdminUi } from '../lib/theme';
import {
  INDUSTRY_FACT_CATEGORIES,
  categoryLabel,
  createIndustryFact,
  deleteIndustryFact,
  fetchAllIndustryFactsAdmin,
  setIndustryFactActive,
  updateIndustryFact,
} from '../lib/industryFacts';

const EMPTY_FORM = {
  category: 'compliance',
  title: '',
  body: '',
  state_code: '',
  source_url: '',
  sort_order: 50,
  is_active: true,
};

export default function IndustryFactsPanel() {
  const { t } = useTheme();
  const ui = getAdminUi();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);

  const labelStyle = { display: 'block', fontSize: 11, color: t.textFaint, marginBottom: 4, fontWeight: 600 };
  const inputStyle = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '9px 10px',
    borderRadius: 8,
    border: t.borderHairline,
    background: t.bgElevated,
    color: t.text,
    fontSize: 13,
    fontFamily: 'inherit',
  };

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    const r = await fetchAllIndustryFactsAdmin();
    setLoading(false);
    if (!r.ok) {
      setErr(r.error || 'Could not load facts. Run supabase-update-37-industry-waiting-facts.sql.');
      setRows([]);
      return;
    }
    setRows(r.rows);
  }, []);

  useEffect(() => { load(); }, [load]);

  const setField = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const startEdit = (row) => {
    setEditId(row.id);
    setForm({
      category: row.category,
      title: row.title || '',
      body: row.body || '',
      state_code: row.state_code || '',
      source_url: row.source_url || '',
      sort_order: row.sort_order ?? 0,
      is_active: row.is_active !== false,
    });
    setMsg('');
    setErr('');
  };

  const cancelEdit = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.body.trim()) {
      setErr('Fact text is required.');
      return;
    }
    setSaving(true);
    setErr('');
    setMsg('');
    const r = editId
      ? await updateIndustryFact(editId, form)
      : await createIndustryFact(form);
    setSaving(false);
    if (!r.ok) {
      setErr(r.error || 'Save failed.');
      return;
    }
    setMsg(editId ? 'Fact updated.' : 'Fact added — live in waiting room.');
    cancelEdit();
    load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this fact?')) return;
    const r = await deleteIndustryFact(id);
    if (!r.ok) { setErr(r.error); return; }
    if (editId === id) cancelEdit();
    load();
  };

  const handleToggle = async (row) => {
    const r = await setIndustryFactActive(row.id, !row.is_active);
    if (!r.ok) { setErr(r.error); return; }
    load();
  };

  return (
    <div style={{ ...ui.card, marginBottom: '1.5rem' }}>
      <div style={ui.sectionLabel}>Waiting room · industry facts</div>
      <p style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.55, marginBottom: 16 }}>
        These rotate for people waiting on access approval — tobacco, hemp, vape, beverages, compliance, and law updates.
        Add new facts anytime (state proposals, federal notices, market shifts). Higher sort order shows first.
      </p>

      {err && (
        <div style={{ fontSize: 12, color: '#c0392b', marginBottom: 12, lineHeight: 1.5 }}>{err}</div>
      )}
      {msg && (
        <div style={{ fontSize: 12, color: t.accent, marginBottom: 12 }}>{msg}</div>
      )}

      <form onSubmit={handleSubmit} style={{ marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={labelStyle}>Category</label>
            <select value={form.category} onChange={(e) => setField('category', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
              {INDUSTRY_FACT_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>State (optional)</label>
            <input value={form.state_code} onChange={(e) => setField('state_code', e.target.value.toUpperCase().slice(0, 2))} placeholder="TX" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Sort priority</label>
            <input type="number" value={form.sort_order} onChange={(e) => setField('sort_order', e.target.value)} style={inputStyle} />
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>Headline (optional)</label>
          <input value={form.title} onChange={(e) => setField('title', e.target.value)} placeholder="Short title" style={inputStyle} maxLength={120} />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>Fact *</label>
          <textarea
            value={form.body}
            onChange={(e) => setField('body', e.target.value)}
            rows={4}
            placeholder="Plain-language update for retailers and distributors…"
            style={{ ...inputStyle, resize: 'vertical', minHeight: 88 }}
            maxLength={1200}
            required
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Source URL (optional)</label>
          <input value={form.source_url} onChange={(e) => setField('source_url', e.target.value)} placeholder="https://…" style={inputStyle} type="url" />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: t.textMuted, marginBottom: 12 }}>
          <input type="checkbox" checked={form.is_active} onChange={(e) => setField('is_active', e.target.checked)} />
          Show in waiting room
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="submit" disabled={saving} style={{
            background: t.btnPrimaryBg,
            color: t.btnPrimaryText,
            border: 'none',
            borderRadius: 8,
            padding: '10px 16px',
            fontSize: 12,
            fontWeight: 600,
            cursor: saving ? 'wait' : 'pointer',
            fontFamily: 'inherit',
          }}>
            {saving ? 'Saving…' : editId ? 'Update fact' : 'Add fact'}
          </button>
          {editId && (
            <button type="button" onClick={cancelEdit} style={{
              background: 'transparent',
              border: t.borderHairline,
              borderRadius: 8,
              padding: '10px 16px',
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: 'inherit',
              color: t.textMuted,
            }}>
              Cancel edit
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <div style={{ fontSize: 13, color: t.textFaint }}>Loading facts…</div>
      ) : rows.length === 0 ? (
        <div style={{ fontSize: 13, color: t.textDisabled }}>No facts yet — add one above or run the SQL migration for starters.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((row) => (
            <div key={row.id} style={{
              ...ui.row,
              flexDirection: 'column',
              alignItems: 'stretch',
              gap: 8,
              opacity: row.is_active ? 1 : 0.55,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 10, color: t.gold, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {categoryLabel(row.category)}
                    {row.state_code ? ` · ${row.state_code}` : ''}
                    {!row.is_active ? ' · hidden' : ''}
                  </div>
                  {row.title && <div style={{ fontWeight: 600, fontSize: 13, marginTop: 4 }}>{row.title}</div>}
                  <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4, lineHeight: 1.5 }}>{row.body}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'flex-start' }}>
                  <button type="button" onClick={() => handleToggle(row)} style={{ fontSize: 11, padding: '4px 8px', cursor: 'pointer', fontFamily: 'inherit', borderRadius: 6, border: t.borderHairline, background: t.bgMuted }}>
                    {row.is_active ? 'Hide' : 'Show'}
                  </button>
                  <button type="button" onClick={() => startEdit(row)} style={{ fontSize: 11, padding: '4px 8px', cursor: 'pointer', fontFamily: 'inherit', borderRadius: 6, border: t.borderHairline, background: t.bgMuted }}>
                    Edit
                  </button>
                  <button type="button" onClick={() => handleDelete(row.id)} style={{ fontSize: 11, padding: '4px 8px', cursor: 'pointer', fontFamily: 'inherit', borderRadius: 6, border: t.borderHairline, background: t.bgMuted, color: '#c0392b' }}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
