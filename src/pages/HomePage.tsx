import React, { useState, useEffect } from 'react'
import { Plus, GitBranch, ArrowRight, Zap, Activity, Wrench } from 'lucide-react'
import { Page } from '../components/Sidebar'
import { Project } from '../shared/types'
import { NewProjectModal } from '../components/NewProjectModal'
import { getRecentProjects } from '../lib/db'

interface HomePageProps {
  onNavigate: (page: Page | string, params?: any) => void
}

const C = {
  bg: 'var(--background)', surface: 'var(--card)', border: 'var(--border)',
  text: 'var(--foreground)', muted: 'var(--muted-foreground)', subtle: '#222222',
  blue: 'var(--foreground)', green: 'var(--foreground)', red: 'var(--foreground)', yellow: 'var(--foreground)',
}

const greeting = (): string => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning.'
  if (h < 18) return 'Good afternoon.'
  return 'Good evening.'
}

const normalizeStatus = (status?: string): string => {
  if (status === 'Analysed') return 'Refracted'
  return status || 'Not analysed'
}

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const normalized = normalizeStatus(status)
  const map: Record<string, string> = {
    Refracted:      'badge-success',
    Pending:        'badge-medium',
    'Not analysed': 'badge-muted',
  }
  const cls = map[normalized] ?? map['Not analysed']
  return (
    <span className="badge badge-muted">
      {normalized}
    </span>
  )
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const p = await getRecentProjects()
        setProjects(p ?? [])
      } catch (err) {
        console.error('Failed to load home data:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const hasProjects = projects.length > 0
  const analysedCount = projects.filter((p: Project) => normalizeStatus(p.status) === 'Refracted').length

  return (
    <div style={{ padding: '40px 40px', height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      <style>{`
        @keyframes pulse { 0%,100% { opacity: 0.4 } 50% { opacity: 1 } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>

      <div style={{ marginBottom: 48, animation: 'fadeUp 0.4s ease' }}>
        <h1 className="page-title" style={{ fontSize: 32, marginBottom: 8 }}>
          {greeting()}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--muted-foreground)', lineHeight: 1.6, maxWidth: 480 }}>
          {!loading && hasProjects
            ? `You have ${projects.length} project${projects.length !== 1 ? 's' : ''} — ${analysedCount > 0 ? `${analysedCount} already refracted.` : 'none analysed yet.'}`
            : !loading && !hasProjects
            ? "No projects yet. Start by adding your first one."
            : 'Loading your projects...'
          }
        </p>
      </div>

      {/* ── Quick actions — only appears if no projects ─────────────────── */}
      {!loading && !hasProjects && (
        <div style={{ marginBottom: 48, animation: 'fadeUp 0.4s ease 0.1s both' }}>
          <button
            onClick={() => setShowModal(true)}
            className="btn btn-primary"
          >
            <Plus size={16} /> Add your first project
          </button>
        </div>
      )}

      {/* ── Recent Projects ───────────────────────────────────────────────────── */}
      <div style={{ animation: 'fadeUp 0.4s ease 0.15s both' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <p className="section-label">
            Recent Projects
          </p>
          {hasProjects && (
            <button
              onClick={() => onNavigate('projects')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: C.muted, display: 'flex', alignItems: 'center', gap: 4, padding: 0, transition: 'color 0.12s ease' }}
              onMouseEnter={e => (e.currentTarget.style.color = C.text)}
              onMouseLeave={e => (e.currentTarget.style.color = C.muted)}>
              View all <ArrowRight size={11} />
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {loading ? (
            [1, 2, 3].map(i => (
              <div key={i} className="card" style={{ padding: 18, minHeight: 120, animation: 'pulse 1.2s infinite ease-in-out' }}>
                <div style={{ width: '60%', height: 10, background: 'var(--muted)', borderRadius: 4, marginBottom: 12 }} />
                <div style={{ width: '40%', height: 8, background: 'var(--muted)', borderRadius: 4 }} />
              </div>
            ))
          ) : (
            <>
              {projects.slice(0, 5).map((p: Project) => (
                <div
                  key={p.id}
                  onClick={() => onNavigate('project-view', { projectId: p.id })}
                  className="card"
                  style={{ padding: '18px 20px', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{p.name}</span>
                    <StatusBadge status={normalizeStatus(p.status)} />
                  </div>
                  <p style={{ fontSize: 10, color: C.muted, fontFamily: 'Geist Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 12 }}>
                    {p.repo || p.path || ''}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className="badge badge-muted" style={{ fontSize: 10, padding: '1px 6px' }}>
                      <GitBranch size={9} /> {p.branch || 'main'}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>
                      {p.last_run ? new Date(p.last_run).toLocaleDateString('en-US') : 'Never'}
                    </span>
                  </div>
                </div>
              ))}

              {/* Add new */}
              <button
                onClick={() => setShowModal(true)}
                className="card"
                style={{ background: 'transparent', borderStyle: 'dashed', padding: '14px 16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 120 }}
              >
                <Plus size={20} className="text-muted-foreground" />
                <span className="section-label" style={{ fontSize: 10 }}>New project</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── What Refract does — only appears if no projects ─────────────── */}
      {!loading && !hasProjects && (
        <div style={{ marginTop: 48, animation: 'fadeUp 0.4s ease 0.2s both' }}>
          <p style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: 16 }}>
            What Refract does
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[
              { icon: <Zap size={18} color="var(--foreground)" />, title: 'Real AST analysis', desc: 'Detects any types, dead state, circular deps, useEffect without deps and more.' },
              { icon: <Activity size={18} color="var(--foreground)" />, title: 'Health Score', desc: '0-100 score per project. See degradation before it becomes a problem.' },
              { icon: <Wrench size={18} color="var(--foreground)" />, title: 'Safe apply', desc: 'Suggestions with diff before applying. Patch by anchor, not by line.' },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="card" style={{ padding: '24px' }}>
                <div style={{ marginBottom: 12 }}>{icon}</div>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', marginBottom: 8, letterSpacing: '-0.02em' }}>{title}</p>
                <p style={{ fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.6 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {showModal && (
        <NewProjectModal
          onClose={() => setShowModal(false)}
          onProjectCreated={(project: Project) => {
            setProjects((prev: Project[]) => [project, ...prev])
            setShowModal(false)
            onNavigate('project-view', { projectId: project.id })
          }}
        />
      )}
    </div>
  )
}
