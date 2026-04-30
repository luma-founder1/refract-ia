import React, { useState } from 'react';
import { Save, Trash2 } from 'lucide-react';

type Theme = 'dark' | 'system';

export const SettingsPage: React.FC = () => {
  const [theme, setTheme] = useState<Theme>('dark');
  const [name, setName]   = useState('Lopes');

  const ThemeToggle: React.FC<{ value: Theme; label: string }> = ({ value, label }) => {
    const active = theme === value;
    return (
      <button
        onClick={() => setTheme(value)}
        style={{
          height: 28,
          padding: '0 12px',
          fontSize: 10,
          fontWeight: 500,
          fontFamily: 'inherit',
          borderRadius: 4,
          border: `1px solid ${active ? '#3B82F6' : '#1c1c1c'}`,
          background: active ? '#0d1a2e' : 'transparent',
          color: active ? '#3B82F6' : '#555',
          cursor: 'pointer',
          transition: 'all 0.12s ease',
        }}
      >
        {label}
      </button>
    );
  };

  const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 0',
        borderBottom: '1px solid #1c1c1c',
      }}
    >
      <span style={{ fontSize: 12, color: '#555', minWidth: 120 }}>{label}</span>
      {children}
    </div>
  );

  return (
    <div style={{ padding: '32px 36px', minHeight: '100%' }}>

      {/* Header */}
      <h1 className="page-title" style={{ marginBottom: 32 }}>Settings</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

        {/* ── Account ── */}
        <section>
          <p className="section-label" style={{ marginBottom: 14 }}>Account</p>
          <div className="card" style={{ padding: 20 }}>
            <Row label="Name">
              <input
                className="input"
                style={{ width: 280, height: 34 }}
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </Row>
            <Row label="Email">
              <input
                className="input"
                style={{ width: 280, height: 34 }}
                value="lopes@example.com"
                disabled
              />
            </Row>
            <Row label="Plan">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="badge badge-success">Pro</span>
                <button className="btn btn-ghost btn-sm">Manage plan</button>
              </div>
            </Row>
            <div style={{ borderBottom: 'none' }}>
              {/* no extra divider needed — last Row already has border-bottom overridden */}
            </div>
            <div style={{ marginTop: 16 }}>
              <button className="btn btn-primary btn-sm">
                <Save size={11} />
                Save changes
              </button>
            </div>
          </div>
        </section>

        {/* ── Appearance ── */}
        <section>
          <p className="section-label" style={{ marginBottom: 14 }}>Appearance</p>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: '#555' }}>Theme</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <ThemeToggle value="dark"   label="Dark"   />
                <ThemeToggle value="system" label="System" />
              </div>
            </div>
          </div>
        </section>

        {/* ── Danger zone ── */}
        <section>
          <p className="section-label" style={{ marginBottom: 14 }}>Danger zone</p>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#fff', marginBottom: 3 }}>
                  Delete account
                </div>
                <div style={{ fontSize: 12, color: '#555' }}>
                  Permanently delete your account and all associated data.
                </div>
              </div>
              <button className="btn btn-danger">
                <Trash2 size={13} />
                Delete account
              </button>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
};
