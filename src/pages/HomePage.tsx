import React, { useState, useEffect } from 'react'
import { Plus, GitBranch, ArrowRight, Zap, Activity, Wrench } from 'lucide-react'
import { Page } from '../components/Sidebar'
import { Project } from '../shared/types'
import { NewProjectModal } from '../components/NewProjectModal'
import { getRecentProjects } from '../lib/db'

interface HomePageProps {
  onNavigate: (page: Page | string, params?: any) => void
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
    <span className={`badge ${cls}`}>
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
    <div style={{ padding: '64px 40px', height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>

      {/* Hero Section */}
      <div style={{ marginBottom: 96, animation: 'fadeUp 0.4s ease', maxWidth: 800 }}>
        <h1 className="page-title" style={{ marginBottom: 24 }}>
          {greeting()}
        </h1>
        <p style={{ 
          fontSize: 24, 
          color: 'var(--ink-muted)', 
          lineHeight: 1.3, 
          letterSpacing: '-0.01px', 
          maxWidth: 600,
          fontFamily: 'var(--font-sans)',
          marginBottom: 32
        }}>
          {!loading && hasProjects
            ? `You have ${projects.length} project${projects.length !== 1 ? 's' : ''} — ${analysedCount > 0 ? `${analysedCount} already refracted.` : 'none analysed yet.'}`
            : !loading && !hasProjects
            ? "No projects yet. Start by adding your first one."
            : 'Loading your projects...'
          }
        </p>

        {/* ── Quick actions — only appears if no projects ─────────────────── */}
        {!loading && !hasProjects && (
          <div style={{ animation: 'fadeUp 0.4s ease 0.1s both' }}>
            <button onClick={() => setShowModal(true)} className="btn btn-primary">
              <Plus size={16} /> Add your first project
            </button>
          </div>
        )}
      </div>

      {/* ── Recent Projects ───────────────────────────────────────────────────── */}
      <div style={{ animation: 'fadeUp 0.4s ease 0.15s both', marginBottom: 96 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ fontSize: 32, letterSpacing: '-1.0px', color: 'var(--ink)' }}>Recent Projects</h2>
          {hasProjects && (
            <button
              onClick={() => onNavigate('projects')}
              className="btn btn-secondary"
            >
              View all <ArrowRight size={14} />
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
          {loading ? (
            [1, 2, 3].map(i => (
              <div key={i} className="card" style={{ minHeight: 110, opacity: 0.5, padding: '16px 20px' }}>
                <div style={{ width: '60%', height: 14, background: 'var(--surface-2)', borderRadius: 4, marginBottom: 16 }} />
                <div style={{ width: '40%', height: 12, background: 'var(--surface-2)', borderRadius: 4 }} />
              </div>
            ))
          ) : (
            <>
              {projects.slice(0, 5).map((p: Project) => (
                <div
                  key={p.id}
                  onClick={() => onNavigate('project-view', { projectId: p.id })}
                  className="card"
                  style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', minHeight: 110, padding: '16px 20px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.3px', color: 'var(--ink)' }}>{p.name}</span>
                    <StatusBadge status={normalizeStatus(p.status)} />
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--ink-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 16 }}>
                    {p.repo || p.path || ''}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                    <span className="badge badge-muted">
                      <GitBranch size={11} /> {p.branch || 'main'}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                      {p.last_run ? new Date(p.last_run).toLocaleDateString('en-US') : 'Never'}
                    </span>
                  </div>
                </div>
              ))}

              {/* Add new */}
              <button
                onClick={() => setShowModal(true)}
                className="card"
                style={{ background: 'transparent', border: '1px dashed var(--hairline)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 110, padding: '16px 20px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)' }}>
                  <Plus size={20} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-muted)' }}>New project</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── What Refract does ─────────────── */}
      {!loading && !hasProjects && (
        <div style={{ animation: 'fadeUp 0.4s ease 0.2s both' }}>
          <p style={{ fontSize: 10, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: 16 }}>
            What Refract does
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div className="card" style={{ padding: 24 }}>
              <div style={{ marginBottom: 12, color: 'var(--ink)' }}><Zap size={18} /></div>
              <p style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', marginBottom: 8 }}>Real AST analysis</p>
              <p style={{ fontSize: 13, color: 'var(--ink-muted)', lineHeight: 1.6 }}>Detects any types, dead state, circular deps, useEffect without deps and more.</p>
            </div>
            
            <div className="card" style={{ padding: 24 }}>
              <div style={{ marginBottom: 12, color: 'var(--ink)' }}><Activity size={18} /></div>
              <p style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', marginBottom: 8 }}>Health Score</p>
              <p style={{ fontSize: 13, color: 'var(--ink-muted)', lineHeight: 1.6 }}>0-100 score per project. See degradation before it becomes a problem.</p>
            </div>

            <div className="card" style={{ padding: 24 }}>
              <div style={{ marginBottom: 12, color: 'var(--ink)' }}><Wrench size={18} /></div>
              <p style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', marginBottom: 8 }}>Safe apply</p>
              <p style={{ fontSize: 13, color: 'var(--ink-muted)', lineHeight: 1.6 }}>Suggestions with diff before applying. Patch by anchor, not by line.</p>
            </div>
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
