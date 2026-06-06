import React from 'react';

const STATUS_COLOR = { online: '#4CAF7D', away: '#C9A84C', offline: '#CCC' };

export default function UserList({ users, onSelect }) {
  if (!users.length) {
    return <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: '#AAA' }}>No users online right now.</div>;
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {users.map(u => (
        <button key={u.user_id} onClick={() => onSelect(u)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', border: 'none', borderBottom: '0.5px solid #F0EDE8', background: '#FFF', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#F0EDE8', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#888', position: 'relative' }}>
            {u.profile_avatar_url ? <img src={u.profile_avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (u.username || u.name || '?')[0].toUpperCase()}
            <div style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: '50%', background: STATUS_COLOR[u.status] || STATUS_COLOR.offline, border: '2px solid #FFF' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>{u.username || u.name || u.email}</div>
            <div style={{ fontSize: 11, color: '#AAA' }}>{u.company || u.role || 'Member'}</div>
          </div>
          <span style={{ fontSize: 11, color: '#4CAF7D', fontWeight: 600 }}>Message</span>
        </button>
      ))}
    </div>
  );
}
