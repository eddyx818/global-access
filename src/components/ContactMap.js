import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { getAdminUi } from '../lib/theme';

const TYPE_COLORS = {
  distributor: '#C9A84C',
  retailer: '#4CAF7D',
};

export default function ContactMap() {
  const { t } = useTheme();
  const ui = getAdminUi();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all' | 'distributor' | 'retailer'
  const [hovering, setHovering] = useState(null);

  useEffect(() => { loadContacts(); }, []);

  const loadContacts = async () => {
    const { data } = await supabase
      .from('access_requests')
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });
    setContacts(data || []);
    setLoading(false);
  };

  // Simple US lat/lng bounds mapping
  // We use a simplified SVG US map projection
  const PROJECT_W = 800;
  const PROJECT_H = 500;

  // Very rough lat/lng to x/y for continental US
  // Lat: 24-49, Lng: -125 to -66
  const project = (lat, lng) => {
    const x = ((lng - (-125)) / ((-66) - (-125))) * PROJECT_W;
    const y = ((49 - lat) / (49 - 24)) * PROJECT_H;
    return { x, y };
  };

  const filtered = contacts.filter(c => {
    if (filter === 'all') return true;
    return c.account_type === filter;
  });

  // State stats
  const distributors = contacts.filter(c => c.account_type === 'distributor').length;
  const retailers = contacts.filter(c => c.account_type === 'retailer').length;
  const withCoords = contacts.filter(c => c.lat && c.lng).length;

  return (
    <div>
      {/* Header stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: '1.5rem' }}>
        {[
          ['Total Contacts', contacts.length, t.text],
          ['Distributors', distributors, '#C9A84C'],
          ['Retailers', retailers, '#4CAF7D'],
          ['On Map', withCoords, '#7B6CF6'],
        ].map(([label, val, color]) => (
          <div key={label} style={{ ...ui.statCard }}>
            <div style={{ fontSize: 11, color: t.textFaint, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 500, color, lineHeight: 1 }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
        {['all','distributor','retailer'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={ui.tabBtn(filter === f)}>
            {f === 'all' ? 'All Contacts' : f + 's'}
          </button>
        ))}
      </div>

      {/* Map */}
      <div style={{ ...ui.card, marginBottom: '1.5rem', position: 'relative', padding: 0, overflow: 'hidden' }}>
        {withCoords === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5, background: t.overlayLight, backdropFilter: 'blur(4px)', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 32, opacity: 0.3 }}>📍</div>
            <div style={{ fontSize: 14, color: t.textFaint, textAlign: 'center', maxWidth: 300 }}>
              Contacts will appear on the map once they've entered their address during signup.
            </div>
          </div>
        )}
        <svg viewBox={`0 0 ${PROJECT_W} ${PROJECT_H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          {/* US outline — simplified */}
          <rect width={PROJECT_W} height={PROJECT_H} fill="var(--ga-bg-muted)" />
          <text x={PROJECT_W/2} y={PROJECT_H/2} textAnchor="middle" dominantBaseline="central" fill="var(--ga-border)" fontSize={48} fontFamily="'Bebas Neue', sans-serif" letterSpacing="0.1em">UNITED STATES</text>

          {/* Grid lines */}
          {[30,35,40,45].map(lat => {
            const { y } = project(lat, -95);
            return <line key={lat} x1={0} y1={y} x2={PROJECT_W} y2={y} stroke="#EEE" strokeWidth={0.5} strokeDasharray="4,4" />;
          })}
          {[-120,-110,-100,-90,-80,-70].map(lng => {
            const { x } = project(35, lng);
            return <line key={lng} x1={x} y1={0} x2={x} y2={PROJECT_H} stroke="#EEE" strokeWidth={0.5} strokeDasharray="4,4" />;
          })}

          {/* Contact pins */}
          {filtered.filter(c => c.lat && c.lng).map(c => {
            const { x, y } = project(c.lat, c.lng);
            const color = TYPE_COLORS[c.account_type] || '#888';
            const isSelected = selected?.id === c.id;
            const isHovered = hovering === c.id;
            return (
              <g key={c.id} onClick={() => setSelected(c)} onMouseEnter={() => setHovering(c.id)} onMouseLeave={() => setHovering(null)} style={{ cursor: 'pointer' }}>
                {/* Pulse ring */}
                {(isSelected || isHovered) && (
                  <circle cx={x} cy={y} r={18} fill={color} opacity={0.15} />
                )}
                {/* Pin shadow */}
                <ellipse cx={x} cy={y + 14} rx={6} ry={2} fill="rgba(0,0,0,0.15)" />
                {/* Pin body */}
                <circle cx={x} cy={y} r={isSelected ? 9 : 7} fill={color} stroke="#FFF" strokeWidth={2} />
                {/* Pin icon */}
                <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill="#FFF" fontSize={isSelected ? 8 : 7} fontWeight="bold">
                  {c.account_type === 'distributor' ? 'D' : 'R'}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div style={{ position: 'absolute', bottom: 12, left: 12, display: 'flex', gap: 10 }}>
          {[['D', '#C9A84C', 'Distributor'], ['R', '#4CAF7D', 'Retailer']].map(([letter, color, label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, background: t.bgElevated, backdropFilter: 'blur(4px)', borderRadius: 6, padding: '4px 8px', border: t.borderHairline }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#FFF', fontWeight: 700 }}>{letter}</div>
              <span style={{ fontSize: 11, color: t.textSecondary }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Selected contact detail */}
      {selected && (
        <div style={{ ...ui.card, border: `0.5px solid ${TYPE_COLORS[selected.account_type] || t.borderLight}`, marginBottom: '1rem', position: 'relative' }}>
          <button onClick={() => setSelected(null)} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: t.textDisabled, fontFamily: 'inherit' }}>×</button>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: (TYPE_COLORS[selected.account_type] || '#888') + '20', border: `2px solid ${TYPE_COLORS[selected.account_type] || '#888'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: TYPE_COLORS[selected.account_type] || '#888', flexShrink: 0 }}>
              {selected.name?.[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 16 }}>{selected.name}</div>
              <div style={{ fontSize: 13, color: t.textMuted, marginTop: 2 }}>{selected.company}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                {selected.email && <a href={`mailto:${selected.email}`} style={{ fontSize: 12, color: t.textSecondary, background: t.bgMuted, padding: '4px 10px', borderRadius: 6, textDecoration: 'none' }}>📧 {selected.email}</a>}
                {selected.phone && <a href={`tel:${selected.phone}`} style={{ fontSize: 12, color: t.textSecondary, background: t.bgMuted, padding: '4px 10px', borderRadius: 6, textDecoration: 'none' }}>📱 {selected.phone}</a>}
                {selected.phone && <a href={`https://wa.me/${selected.phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: t.successText, background: t.successBg, padding: '4px 10px', borderRadius: 6, textDecoration: 'none', border: `0.5px solid ${t.successBorder}` }}>💬 WhatsApp</a>}
              </div>
              {selected.address && <div style={{ fontSize: 12, color: t.textFaint, marginTop: 6 }}>📍 {selected.address}</div>}
              {selected.store_type && <div style={{ fontSize: 12, color: t.textFaint, marginTop: 4 }}>🏪 {selected.store_type} · {selected.location_count || 1} location{(selected.location_count || 1) > 1 ? 's' : ''}</div>}
            </div>
          </div>
        </div>
      )}

      {/* Contact list */}
      <div style={ui.sectionLabel}>Contact List</div>
      {loading && <div style={{ fontSize: 13, color: t.textFaint }}>Loading...</div>}
      {!loading && filtered.length === 0 && <div style={{ fontSize: 13, color: t.textFaint }}>No contacts yet.</div>}
      {filtered.map(c => (
        <div key={c.id} onClick={() => setSelected(c)}
          style={{ background: selected?.id === c.id ? t.bgHover : t.bgElevated, border: `0.5px solid ${selected?.id === c.id ? (TYPE_COLORS[c.account_type] || t.borderLight) : t.borderLight}`, borderRadius: 12, padding: '1rem', marginBottom: 8, cursor: 'pointer', transition: 'all 0.15s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 500, color: t.text }}>{c.name} — {c.company}</div>
              <div style={{ fontSize: 12, color: t.textFaint, marginTop: 2 }}>{c.email} · {c.phone}</div>
              {c.address && <div style={{ fontSize: 11, color: t.textDisabled, marginTop: 2 }}>📍 {c.address}</div>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 20, background: (TYPE_COLORS[c.account_type] || '#888') + '18', color: TYPE_COLORS[c.account_type] || '#888', fontWeight: 600, textTransform: 'capitalize', letterSpacing: '0.06em' }}>{c.account_type || 'unknown'}</span>
              {c.store_type && <span style={{ fontSize: 10, color: '#CCC' }}>{c.store_type}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
