import React, { useState, useEffect } from 'react';
import { supabase, supabaseAdmin } from '../lib/supabase';
import { generateRepCodeFromName, normalizeRepCode } from '../lib/repCodes';
import { formatRoleLabel } from '../lib/roles';
import { BRANDS } from '../lib/data';
import { CRM_TIER, normalizeMasterBrandIds } from '../lib/accountBadges';
import CustomerBadges from './CustomerBadges';
import { useTheme } from '../context/ThemeContext';
import { getAdminUi } from '../lib/theme';

const ROLES = ['retailer', 'distributor', 'sales_rep', 'admin'];
const ROLE_COLORS = { retailer: '#4CAF7D', distributor: '#C9A84C', sales_rep: '#E07A5F', admin: '#7B6CF6' };

export default function UserManager() {
  const { t } = useTheme();
  const ui = getAdminUi();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ email: '', password: '', role: 'retailer', name: '', company: '' });
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saved, setSaved] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    setLoading(true);
    // Load from user_profiles table (we'll create this)
    const { data } = await supabase.from('user_profiles').select('*').order('created_at', { ascending: false });
    setUsers(data || []);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!createForm.email || !createForm.password) { setError('Email and password are required.'); return; }
    if (createForm.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setCreating(true); setError('');
    try {
      // Create auth user via Supabase
      const { data, error: err } = await supabaseAdmin.auth.admin.createUser({
        email: createForm.email.trim().toLowerCase(),
        password: createForm.password,
        email_confirm: true,
        user_metadata: { role: createForm.role, name: createForm.name, company: createForm.company },
      });
      if (err) throw err;
      // Save profile
      await supabaseAdmin.from('user_profiles').insert({
        user_id: data.user.id,
        email: createForm.email.trim().toLowerCase(),
        name: createForm.name.trim() || null,
        company: createForm.company.trim() || null,
        role: createForm.role,
        is_portal_admin: createForm.role === 'admin',
        is_sales_rep: createForm.role === 'sales_rep',
        rep_code: createForm.role === 'sales_rep' || createForm.role === 'admin'
          ? normalizeRepCode(generateRepCodeFromName(createForm.name || createForm.email, data.user.id))
          : null,
        temp_password: createForm.password,
        created_at: new Date().toISOString(),
      });
      setSaved(`Account created for ${createForm.email}`);
      setCreateForm({ email: '', password: '', role: 'retailer', name: '', company: '' });
      setShowCreate(false);
      loadUsers();
      setTimeout(() => setSaved(''), 3000);
    } catch (err) {
      setError(err.message || 'Could not create user. Check Supabase service role key.');
    }
    setCreating(false);
  };

  const handleEdit = (user) => {
    setEditing(user.id);
    setEditForm({
      name: user.name || '',
      company: user.company || '',
      role: user.role || 'retailer',
      rep_code: user.rep_code || '',
      crm_tier: user.crm_tier || '',
      master_brand_ids: normalizeMasterBrandIds(user.master_brand_ids),
      new_password: '',
      master_pricing_qualified: !!user.master_pricing_qualified,
    });
  };

  const handleSaveEdit = async (user) => {
    setError('');
    try {
      const name = editForm.name?.trim() || null;
      const company = editForm.company?.trim() || null;
      const role = editForm.role || 'retailer';
      const isSalesRep = role === 'sales_rep';
      const isAdminRole = role === 'admin';
      let repCode = editForm.rep_code?.trim() ? normalizeRepCode(editForm.rep_code) : user.rep_code;
      if ((isSalesRep || isAdminRole) && !repCode) {
        repCode = normalizeRepCode(generateRepCodeFromName(name || user.email, user.user_id));
      }
      if (!isSalesRep && !isAdminRole) repCode = null;

      let crmTier = editForm.crm_tier || null;
      if (role === 'retailer' && crmTier === CRM_TIER.WHALE) crmTier = null;
      if (role === 'distributor' && crmTier === CRM_TIER.VIP) crmTier = null;
      const masterBrandIds = role === 'distributor'
        ? normalizeMasterBrandIds(editForm.master_brand_ids)
        : [];

      const { error: profileErr } = await supabaseAdmin
        .from('user_profiles')
        .update({
          name,
          company,
          role,
          is_portal_admin: isAdminRole,
          is_sales_rep: isSalesRep,
          rep_code: repCode,
          crm_tier: crmTier,
          master_brand_ids: masterBrandIds,
          master_pricing_qualified: role === 'distributor' ? !!editForm.master_pricing_qualified : false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
      if (profileErr) throw profileErr;

      const { error: metaErr } = await supabaseAdmin.auth.admin.updateUserById(user.user_id, {
        user_metadata: { role, name, company },
      });
      if (metaErr) throw metaErr;

      if (editForm.new_password && editForm.new_password.length >= 6) {
        const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(user.user_id, {
          password: editForm.new_password,
        });
        if (pwErr) throw pwErr;
      }

      setSaved('User updated!');
      setTimeout(() => setSaved(''), 2000);
      setEditing(null);
      await loadUsers();
    } catch (err) {
      setError(err.message || 'Could not save user.');
    }
  };

  const handleDisable = async (user) => {
    if (!window.confirm(`Disable access for ${user.email}?`)) return;
    try {
      await supabaseAdmin.auth.admin.updateUserById(user.user_id, { ban_duration: '876000h' });
      await supabaseAdmin.from('user_profiles').update({ disabled: true }).eq('id', user.id);
      loadUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEnable = async (user) => {
    try {
      await supabaseAdmin.auth.admin.updateUserById(user.user_id, { ban_duration: 'none' });
      await supabaseAdmin.from('user_profiles').update({ disabled: false }).eq('id', user.id);
      loadUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  const generatePassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  const inputStyle = { ...ui.input, fontSize: 13 };
  const labelStyle = { fontSize: 11, color: t.textFaint, display: 'block', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' };
  const card = { ...ui.card, marginBottom: 10 };
  const secBtn = { background: t.bgHover, border: t.borderHairline, borderRadius: 8, padding: '8px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: t.textSecondary };
  const primaryBtn = { background: t.btnPrimaryBg, color: t.btnPrimaryText, border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div style={ui.sectionLabel}>User Accounts ({users.length})</div>
        <button onClick={() => setShowCreate(!showCreate)} style={primaryBtn}>
          {showCreate ? '× Cancel' : '+ Add User'}
        </button>
      </div>

      {saved && <div style={{ background: t.successBg, border: `0.5px solid ${t.successBorder}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: t.successText, marginBottom: 12 }}>{saved}</div>}
      {error && <div style={{ background: t.errorBg, border: `0.5px solid ${t.errorBorder}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: t.errorText, marginBottom: 12 }}>{error} <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.errorText, fontFamily: 'inherit', fontSize: 13, marginLeft: 8 }}>×</button></div>}

      {/* Create user form */}
      {showCreate && (
        <div style={{ ...ui.card, borderRadius: 14, marginBottom: '1.5rem' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: '1.25rem' }}>Create New Account</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Name</label>
              <input value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} autoCapitalize="words" />
            </div>
            <div>
              <label style={labelStyle}>Company</label>
              <input value={createForm.company} onChange={e => setCreateForm(f => ({ ...f, company: e.target.value }))} style={inputStyle} autoCapitalize="words" />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Email *</label>
            <input value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} placeholder="user@company.com" style={inputStyle} autoCapitalize="none" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Temporary Password *</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} placeholder="Min 6 characters" style={{ ...inputStyle, flex: 1 }} />
              <button onClick={() => setCreateForm(f => ({ ...f, password: generatePassword() }))} style={{ ...secBtn, padding: '10px 14px', whiteSpace: 'nowrap' }}>
                Generate
              </button>
            </div>
          </div>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={labelStyle}>Role / Access Level *</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {ROLES.map(role => (
                <button key={role} onClick={() => setCreateForm(f => ({ ...f, role }))}
                  style={{ flex: 1, padding: '10px 8px', border: `0.5px solid ${createForm.role === role ? ROLE_COLORS[role] : t.border}`, borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, background: createForm.role === role ? ROLE_COLORS[role] + '18' : t.bgElevated, color: createForm.role === role ? ROLE_COLORS[role] : t.textMuted, fontWeight: createForm.role === role ? 600 : 400, transition: 'all 0.15s' }}>
                  {formatRoleLabel(role)}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: t.textDisabled, marginTop: 6 }}>
              {createForm.role === 'retailer' ? 'Sees individual flavors, case ordering' :
               createForm.role === 'distributor' ? 'Sees pallet configs, bulk ordering' :
               createForm.role === 'sales_rep' ? 'Sales dashboard — own customers, messages, and contact imports. Gets a personal access code.' :
               'Full admin dashboard access — use carefully'}
            </div>
          </div>
          <button onClick={handleCreate} disabled={creating}
            style={{ width: '100%', background: creating ? t.border : t.btnPrimaryBg, color: creating ? t.textFaint : t.btnPrimaryText, border: 'none', borderRadius: 10, padding: '13px', fontSize: 13, fontWeight: 700, cursor: creating ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {creating ? 'Creating account...' : 'Create Account →'}
          </button>
        </div>
      )}

      {/* Users list */}
      {loading && <div style={{ fontSize: 13, color: t.textFaint }}>Loading users...</div>}
      {!loading && users.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2rem', fontSize: 13, color: t.textDisabled }}>
          No user accounts yet. Click "Add User" to create one.
        </div>
      )}
      {users.map(user => (
        <div key={user.id} style={{ ...card, borderLeft: `3px solid ${ROLE_COLORS[user.role] || '#E8E4DF'}`, opacity: user.disabled ? 0.5 : 1 }}>
          {editing === user.id ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                {[['name', 'Name'], ['company', 'Company']].map(([field, label]) => (
                  <div key={field}>
                    <label style={labelStyle}>{label}</label>
                    <input value={editForm[field] || ''} onChange={e => setEditForm(f => ({ ...f, [field]: e.target.value }))} style={inputStyle} />
                  </div>
                ))}
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>Role</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {ROLES.map(role => (
                    <button key={role} onClick={() => setEditForm(f => ({ ...f, role }))}
                      style={{ flex: 1, padding: '9px 4px', border: `0.5px solid ${editForm.role === role ? ROLE_COLORS[role] : t.border}`, borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, background: editForm.role === role ? ROLE_COLORS[role] + '18' : t.bgElevated, color: editForm.role === role ? ROLE_COLORS[role] : t.textMuted, fontWeight: editForm.role === role ? 600 : 400, transition: 'all 0.15s' }}>
                      {formatRoleLabel(role)}
                    </button>
                  ))}
                </div>
              </div>
              {(editForm.role === 'sales_rep' || editForm.role === 'admin') && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={labelStyle}>Personal access code</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={editForm.rep_code || ''} onChange={e => setEditForm(f => ({ ...f, rep_code: e.target.value }))} placeholder="e.g. jane-a1b2" style={{ ...inputStyle, flex: 1 }} />
                    <button type="button" onClick={() => setEditForm(f => ({ ...f, rep_code: normalizeRepCode(generateRepCodeFromName(f.name || user.email, user.user_id)) }))} style={secBtn}>
                      Generate
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: t.textFaint, marginTop: 6 }}>Retailers enter this at the gate so you get credit for sign-ups.</div>
                </div>
              )}
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>New Password (leave blank to keep current)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={editForm.new_password || ''} onChange={e => setEditForm(f => ({ ...f, new_password: e.target.value }))} placeholder="Leave blank to keep current" style={{ ...inputStyle, flex: 1 }} />
                  <button onClick={() => setEditForm(f => ({ ...f, new_password: generatePassword() }))} style={secBtn}>
                    Generate
                  </button>
                </div>
              </div>
              {editForm.role === 'retailer' && (
                <div style={{ marginBottom: '1rem', padding: '12px 14px', background: t.warningBg, border: `0.5px solid ${t.warningBorder}`, borderRadius: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 13, color: t.textSecondary }}>
                    <input
                      type="checkbox"
                      checked={editForm.crm_tier === CRM_TIER.VIP}
                      onChange={e => setEditForm(f => ({ ...f, crm_tier: e.target.checked ? CRM_TIER.VIP : '' }))}
                      style={{ marginTop: 2 }}
                    />
                    <span>
                      <strong style={{ color: '#A07A20' }}>★ Key account (VIP)</strong>
                      <span style={{ display: 'block', fontSize: 11, color: t.textMuted, marginTop: 4, lineHeight: 1.45 }}>
                        Shows a star badge for your team in messages and the customer directory.
                      </span>
                    </span>
                  </label>
                </div>
              )}
              {editForm.role === 'distributor' && (
                <div style={{ marginBottom: '1rem', padding: '12px 14px', background: '#EFF6FF', border: '0.5px solid #BFDBFE', borderRadius: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 13, color: '#555' }}>
                    <input
                      type="checkbox"
                      checked={editForm.crm_tier === CRM_TIER.WHALE}
                      onChange={e => setEditForm(f => ({ ...f, crm_tier: e.target.checked ? CRM_TIER.WHALE : '' }))}
                      style={{ marginTop: 2 }}
                    />
                    <span>
                      <strong style={{ color: '#2563EB' }}>🐋 Whale account</strong>
                      <span style={{ display: 'block', fontSize: 11, color: t.textMuted, marginTop: 4, lineHeight: 1.45 }}>
                        Top-tier distributor — visible to your team in chat and CRM lists.
                      </span>
                    </span>
                  </label>
                </div>
              )}
              {editForm.role === 'distributor' && (
                <div style={{ marginBottom: '1rem', padding: '12px 14px', background: '#F5F3FF', border: '0.5px solid #DDD6FE', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: '#7B6CF6', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10, fontWeight: 600 }}>Master on brands</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {BRANDS.map(brand => {
                      const checked = (editForm.master_brand_ids || []).includes(brand.id);
                      return (
                        <label key={brand.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#555' }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={e => setEditForm(f => ({
                              ...f,
                              master_brand_ids: e.target.checked
                                ? [...(f.master_brand_ids || []), brand.id]
                                : (f.master_brand_ids || []).filter(id => id !== brand.id),
                            }))}
                          />
                          <span>★ Master · {brand.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
              {editForm.role === 'distributor' && (
                <div style={{ marginBottom: '1rem', padding: '12px 14px', background: '#FDF6E3', border: '0.5px solid #F5D87A', borderRadius: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 13, color: '#555' }}>
                    <input
                      type="checkbox"
                      checked={!!editForm.master_pricing_qualified}
                      onChange={e => setEditForm(f => ({ ...f, master_pricing_qualified: e.target.checked }))}
                      style={{ marginTop: 2 }}
                    />
                    <span>
                      <strong style={{ color: '#A07A20' }}>Master Distributor qualified</strong>
                      <span style={{ display: 'block', fontSize: 11, color: t.textMuted, marginTop: 4, lineHeight: 1.45 }}>
                        Unlocks the private Master price list on brand pages for this account.
                      </span>
                    </span>
                  </label>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleSaveEdit(user)} style={{ ...primaryBtn, padding: '9px 20px' }}>Save</button>
                <button onClick={() => setEditing(null)} style={{ background: 'none', border: t.borderHairline, borderRadius: 8, padding: '9px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: t.textFaint }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: 500, fontSize: 15 }}>{user.name || 'Unnamed'}</div>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: (ROLE_COLORS[user.role] || '#888') + '18', color: ROLE_COLORS[user.role] || '#888', fontWeight: 600, letterSpacing: '0.06em' }}>{formatRoleLabel(user.role) || 'Unknown'}</span>
                  <CustomerBadges profile={user} />
                  {user.disabled && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: t.errorBg, color: t.errorText, fontWeight: 600 }}>Disabled</span>}
                  {user.role === 'distributor' && user.master_pricing_interest && !user.master_pricing_qualified && (
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: t.bgHover, color: t.textMuted, fontWeight: 600 }}>Volume interest</span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: t.textMuted }}>{user.company || '—'}</div>
                <div style={{ fontSize: 12, color: t.textFaint, marginTop: 2 }}>{user.email}</div>
                {user.rep_code && (
                  <div style={{ fontSize: 11, color: '#C9A84C', marginTop: 4, fontWeight: 600 }}>Code: {user.rep_code}</div>
                )}
                {user.temp_password && (
                  <div style={{ fontSize: 11, color: t.textDisabled, marginTop: 3 }}>Temp password: <span style={{ fontFamily: 'monospace', background: t.bgHover, padding: '1px 6px', borderRadius: 4 }}>{user.temp_password}</span></div>
                )}
                <div style={{ fontSize: 11, color: t.textDisabled, marginTop: 2 }}>{new Date(user.created_at).toLocaleDateString()}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => handleEdit(user)} style={secBtn}>Edit</button>
                {user.disabled ? (
                  <button onClick={() => handleEnable(user)} style={{ ...secBtn, background: t.successBg, border: `0.5px solid ${t.successBorder}`, color: t.successText }}>Enable</button>
                ) : (
                  <button onClick={() => handleDisable(user)} style={{ ...secBtn, background: t.errorBg, border: `0.5px solid ${t.errorBorder}`, color: t.errorText }}>Disable</button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
