import React, { useState } from 'react';
import { BRANDS } from '../../lib/data';
import { createGroupConversation, getOrCreateBrandGroup, joinGroupChat } from '../../lib/community';

export default function GroupList({ user, conversations, onlineUsers, onOpenGroup, onCreated }) {
  const [creating, setCreating] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const myGroups = conversations.filter(c => c.is_group && !c.brand_id);
  const myBrandGroups = conversations.filter(c => c.is_group && c.brand_id);
  const joinedBrandIds = new Set(myBrandGroups.map(c => c.brand_id));

  const toggleUser = (userId) => {
    setSelected(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
  };

  const handleCreate = async () => {
    if (!groupName.trim()) { setError('Enter a group name.'); return; }
    setSaving(true);
    setError('');
    try {
      const convo = await createGroupConversation(user.id, groupName, selected);
      setCreating(false);
      setGroupName('');
      setSelected([]);
      onCreated(convo);
    } catch (err) {
      setError(err.message || 'Could not create group.');
    }
    setSaving(false);
  };

  const openBrandChannel = async (brand) => {
    setSaving(true);
    setError('');
    try {
      const convo = await getOrCreateBrandGroup(brand.id, brand.name, user.id);
      onOpenGroup(convo);
    } catch (err) {
      setError(err.message || 'Could not open brand channel.');
    }
    setSaving(false);
  };

  const openExistingBrand = async (convo) => {
    setSaving(true);
    try {
      if (!convo.participant_user_ids.includes(user.id)) {
        await joinGroupChat(convo.id);
      }
      onOpenGroup(convo);
    } catch (err) {
      setError(err.message || 'Could not join group.');
    }
    setSaving(false);
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{ padding: '12px 14px', borderBottom: '0.5px solid #F0EDE8' }}>
        {!creating ? (
          <button onClick={() => setCreating(true)}
            style={{ width: '100%', background: '#1A1A1A', color: '#FFF', border: 'none', borderRadius: 8, padding: '10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            + Create group chat
          </button>
        ) : (
          <div style={{ background: '#F8F6F3', borderRadius: 10, padding: 12, border: '0.5px solid #E0DDD8' }}>
            <div style={{ fontSize: 11, color: '#AAA', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>New group</div>
            <input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Group name"
              style={{ width: '100%', boxSizing: 'border-box', background: '#FFF', border: '0.5px solid #E0DDD8', borderRadius: 8, padding: '9px 10px', fontSize: 13, marginBottom: 8, fontFamily: 'inherit', outline: 'none' }} />
            <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>Add members (optional)</div>
            <div style={{ maxHeight: 100, overflowY: 'auto', marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {onlineUsers.map(u => (
                <label key={u.user_id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#555', cursor: 'pointer' }}>
                  <input type="checkbox" checked={selected.includes(u.user_id)} onChange={() => toggleUser(u.user_id)} />
                  {u.username || u.name || u.email}
                </label>
              ))}
              {!onlineUsers.length && <div style={{ fontSize: 11, color: '#CCC' }}>No other users online — you can add members later.</div>}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => { setCreating(false); setError(''); }} style={{ flex: 1, background: '#FFF', border: '0.5px solid #E0DDD8', borderRadius: 8, padding: '8px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={handleCreate} disabled={saving} style={{ flex: 1, background: '#4CAF7D', color: '#FFF', border: 'none', borderRadius: 8, padding: '8px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {saving ? '...' : 'Create'}
              </button>
            </div>
          </div>
        )}
        {error && <div style={{ fontSize: 11, color: '#C53030', marginTop: 8 }}>{error}</div>}
      </div>

      <div style={{ padding: '10px 14px 4px', fontSize: 10, color: '#BBB', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Brand channels</div>
      {BRANDS.map(brand => {
        const existing = myBrandGroups.find(c => c.brand_id === brand.id);
        const isMember = joinedBrandIds.has(brand.id);
        return (
          <button key={brand.id} onClick={() => existing ? openExistingBrand(existing) : openBrandChannel(brand)} disabled={saving}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', border: 'none', borderBottom: '0.5px solid #F0EDE8', background: '#FFF', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: brand.color + '22', border: `0.5px solid ${brand.color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: brand.color, flexShrink: 0 }}>
              {brand.name[0]}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>{brand.name} Channel</div>
              <div style={{ fontSize: 11, color: '#AAA' }}>{isMember ? `${existing?.participant_user_ids?.length || 1} members` : 'Tap to join'}</div>
            </div>
            <span style={{ fontSize: 10, color: isMember ? '#4CAF7D' : '#888', fontWeight: 600 }}>{isMember ? 'Open' : 'Join'}</span>
          </button>
        );
      })}

      {myGroups.length > 0 && (
        <>
          <div style={{ padding: '10px 14px 4px', fontSize: 10, color: '#BBB', letterSpacing: '0.08em', textTransform: 'uppercase' }}>My groups</div>
          {myGroups.map(convo => (
            <button key={convo.id} onClick={() => onOpenGroup(convo)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', border: 'none', borderBottom: '0.5px solid #F0EDE8', background: '#FFF', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#E8E4DF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#666' }}>👥</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>{convo.group_name || 'Group'}</div>
                <div style={{ fontSize: 11, color: '#AAA' }}>{convo.participant_user_ids.length} members</div>
              </div>
            </button>
          ))}
        </>
      )}
    </div>
  );
}
