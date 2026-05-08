import React, { useState } from 'react'
import { Save, Trash2, Zap, FileText, Check } from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const C = {
  bg: '#0a0a0a', surface: '#111111', border: '#1a1a1a',
  text: '#ffffff', muted: '#444444', subtle: '#222222',
  blue: '#6366F1', green: '#4ade80', red: '#ef4444',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const Row: React.FC<{ label: string; desc?: string; children: React.ReactNode; last?: boolean }> = ({ label, desc, children, last }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: last ? 'none' : `1px solid ${C.border}`, gap: 16 }}>
    <div>
      <span style={{ fontSize: 12, color: C.text, display: 'block', marginBottom: desc ? 2 : 0 }}>{label}</span>
      {desc && <span style={{ fontSize: 11, color: C.muted }}>{desc}</span>}
    </div>
    {children}
  </div>
)

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: 12 }}>{children}</p>
)

// ─── Main ─────────────────────────────────────────────────────────────────────

export const SettingsPage: React.FC = () => {
  const [name, setName] = useState('Lopes')
  const [saved, setSaved] = useState(false)
  const [guidelines, setGuidelines] = useState(
    '# Global Guidelines\n\n' +
    '- Usa TypeScript estrito — sem any\n' +
    '- Componentes com menos de 100 linhas\n' +
    '- Nomes descritivos — sem data, item, temp\n' +
    '- Documenta todos os exports públicos\n'
  )
  const [guidelinesSaved, setGuidelinesSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleSaveAccount = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleSaveGuidelines = () => {
    setGuidelinesSaved(true)
    setTimeout(() => setGuidelinesSaved(false), 2000)
  }

  const handleClearData = () => {
    if (confirmDelete) {
      // limpar SQLite local — IPC call quando backend estiver pronto
      setConfirmDelete(false)
    } else {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 4000)
    }
  }

  return (
    <div style={{ padding: '32px 36px', height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      <h1 className="page-title" style={{ marginBottom: 32 }}>Settings</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 32, maxWidth: 640 }}>

        {/* ── Account ─────────────────────────────────────────────────────── */}
        <section>
          <SectionLabel>Account</SectionLabel>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '4px 20px' }}>
            <Row label="Name">
              <input
                className="input"
                style={{ width: 240, height: 32 }}
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </Row>
            <Row label="Email">
              <input
                className="input"
                style={{ width: 240, height: 32, opacity: 0.5 }}
                value="lopes@example.com"
                disabled
              />
            </Row>
            <Row label="Plan" desc="Estás no plano Free" last>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, background: C.subtle, color: C.muted, borderRadius: 4, padding: '2px 8px', fontWeight: 500 }}>Free</span>
              </div>
            </Row>
          </div>
          <div style={{ marginTop: 12 }}>
            <button
              onClick={handleSaveAccount}
              className="btn btn-primary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {saved ? <Check size={11} /> : <Save size={11} />}
              {saved ? 'Saved' : 'Save changes'}
            </button>
          </div>
        </section>

        {/* ── Upgrade ─────────────────────────────────────────────────────── */}
        <section>
          <SectionLabel>Upgrade</SectionLabel>
          <div style={{ background: 'linear-gradient(135deg, #0d0d1f 0%, #111111 100%)', border: `1px solid ${C.blue}33`, borderRadius: 8, padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Zap size={14} color={C.blue} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Refract Pro</span>
                  <span style={{ fontSize: 10, color: C.blue, background: `${C.blue}18`, borderRadius: 4, padding: '2px 6px', fontWeight: 600 }}>$20/mo</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {[
                    'Projetos ilimitados',
                    'Anomaly Detection',
                    'Instability Tracking',
                    'Pattern Consistency',
                    'Histórico ilimitado',
                  ].map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Check size={10} color={C.blue} />
                      <span style={{ fontSize: 11, color: C.muted }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button
                style={{ flexShrink: 0, height: 34, padding: '0 16px', background: C.blue, border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer', transition: 'opacity 0.12s ease', whiteSpace: 'nowrap' }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                Upgrade to Pro
              </button>
            </div>
          </div>
        </section>

        {/* ── Guidelines ──────────────────────────────────────────────────── */}
        <section>
          <SectionLabel>Global Guidelines</SectionLabel>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '16px' }}>
            <p style={{ fontSize: 11, color: C.muted, marginBottom: 12, lineHeight: 1.6 }}>
              Estas guidelines são injetadas como contexto em todas as análises e refactorizações. Define os padrões do teu projeto.
            </p>
            <textarea
              value={guidelines}
              onChange={e => setGuidelines(e.target.value)}
              style={{
                width: '100%', minHeight: 180, background: C.bg,
                border: `1px solid ${C.border}`, borderRadius: 6,
                padding: '10px 12px', fontSize: 12, color: '#ccc',
                fontFamily: 'Geist Mono, monospace', lineHeight: 1.6,
                resize: 'vertical', outline: 'none', boxSizing: 'border-box',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = C.blue)}
              onBlur={e => (e.currentTarget.style.borderColor = C.border)}
            />
          </div>
          <div style={{ marginTop: 12 }}>
            <button
              onClick={handleSaveGuidelines}
              className="btn btn-primary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {guidelinesSaved ? <Check size={11} /> : <FileText size={11} />}
              {guidelinesSaved ? 'Saved' : 'Save guidelines'}
            </button>
          </div>
        </section>

        {/* ── Danger zone ─────────────────────────────────────────────────── */}
        <section>
          <SectionLabel>Danger zone</SectionLabel>
          <div style={{ background: C.surface, border: `1px solid #2a1a1a`, borderRadius: 8, padding: '4px 20px' }}>
            <Row label="Clear local data" desc="Remove todos os projetos e histórico guardados localmente." last>
              <button
                onClick={handleClearData}
                style={{
                  height: 30, padding: '0 14px', flexShrink: 0,
                  background: confirmDelete ? C.red : 'transparent',
                  border: `1px solid ${confirmDelete ? C.red : '#2a1a1a'}`,
                  borderRadius: 5, fontSize: 11, fontWeight: 500,
                  color: confirmDelete ? '#fff' : C.red,
                  cursor: 'pointer', transition: 'all 0.12s ease',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                <Trash2 size={11} />
                {confirmDelete ? 'Tens a certeza?' : 'Clear data'}
              </button>
            </Row>
          </div>
        </section>

      </div>
    </div>
  )
}
