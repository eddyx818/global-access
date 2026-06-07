import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import ProfileModal from './ProfileModal';
import { useTheme } from '../context/ThemeContext';

export default function DashboardProfilePanel({ user, isStaff = true }) {
  const { t } = useTheme();
  const [form, setForm] = useState({ name: '', company: '', phone: '', email: user?.email || '', notes: '' });
  const [userType, setUserType] = useState('retailer');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user?.id) return undefined;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('name, company, phone, email, role')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setForm(f => ({
          ...f,
          name: data.name || '',
          company: data.company || '',
          phone: data.phone || '',
          email: data.email || user.email || '',
        }));
        setUserType(data.role || 'retailer');
      } else {
        setForm(f => ({ ...f, email: user.email || '' }));
      }
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [user?.id, user?.email]);

  if (!ready) {
    return <div style={{ fontSize: 13, color: t.textFaint }}>Loading profile…</div>;
  }

  return (
    <div className="app-no-select">
      <ProfileModal
        user={user}
        form={form}
        setForm={setForm}
        userType={userType}
        setUserType={setUserType}
        isStaff={isStaff}
        variant="page"
        onClose={() => {}}
        pwa={{}}
      />
    </div>
  );
}
