import React, { useState, useEffect } from 'react'
import {
  Plus, FolderOpen, GitBranch, Play, Trash2, Loader2,
  TrendingDown, TrendingUp, Minus, Lock, X, Activity,
  AlertTriangle, CheckCircle, Clock, ChevronRight, Zap,
} from 'lucide-react'
import { Project } from '../shared/types'
import { NewProjectModal } from '../components/NewProjectModal'
import { hasPricingUrl, openPricingUrl } from '../lib/billing'
import { getAllProjects, deleteProject, getHealthSnapshots } from '../lib/db'

// ─── Constants ────────────────────────────────────────────────────────────────

const C = {
  bg: 'var(--canvas)', surface: 'var(--surface-1)', border: 'var(--hairline)',
  text: 'var(--ink)', muted: 'var(--ink-muted)', subtle: 'var(--surface-2)',
  blue: 'var(--accent-blue)', green: 'var(--semantic-success)', red: 'var(--gradient-coral)',
  yellow: 'var(--gradient-orange)', blueHover: 'var(--accent-blue)',
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface HealthSnapshot {
  score: number
  timestamp: string
  issueCount: number
  high: number
  medium: number
  low: number
}

interface ProjectWithHealth extends Project {
  healthScore?: number
  lastSnapshot?: HealthSnapshot
  prevSnapshot?: HealthSnapshot
  snapshots?: HealthSnapshot[]
}

// ─── Health Score helpers ─────────────────────────────────────────────────────

function getScoreColor(score: number): string {
  if (score >= 80) return C.green
  if (score >= 55) return C.yellow
  return C.red
}

function getScoreBg(score: number): string {
  if (score >= 80) return 'rgba(0, 112, 243, 0.1)'
  if (score >= 55) return 'rgba(10, 114, 239, 0.1)'
  return 'rgba(255, 91, 79, 0.1)'
}

function getDelta(current?: HealthSnapshot, prev?: HealthSnapshot): number | null {
  if (!current || !prev) return null
  return current.score - prev.score
}

// Mini sparkline — SVG simples baseado em scores
const Sparkline: React.FC<{ snapshots: HealthSnapshot[]; color: string }> = ({ snapshots, color }) => {
  if (snapshots.length < 2) return null
  const W = 64, H = 24
  const scores = snapshots.map((s: HealthSnapshot) => s.score)
  const min = Math.min(...scores)
  const max = Math.max(...scores)
  const range = max - min || 1

  const points = scores.map((s: number, i: number) => {
    const x = (i / (scores.length - 1)) * W
    const y = H - ((s - min) / range) * H
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={W} height={H} style={{ overflow: 'visible' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
    </svg>
  )
}

// ─── Score Ring ───────────────────────────────────────────────────────────────

const ScoreRing: React.FC<{ score: number; size?: number }> = ({ score, size = 48 }) => {
  const r = (size - 6) / 2
  const circ = 2 * Math.PI * r
  const filled = (score / 100) * circ
  const color = getScoreColor(score)

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={2} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={2}
        strokeDasharray={`${filled} ${circ}`} strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.6s ease' }} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle"
        style={{ fill: color, fontSize: size * 0.32, fontWeight: 600, transform: 'rotate(90deg)', transformOrigin: '50% 50%', fontFamily: 'var(--font-mono)' }}>
        {score}
      </text>
    </svg>
  )
}

// ─── Monitor Panel ────────────────────────────────────────────────────────────

const MonitorPanel: React.FC<{
  project: ProjectWithHealth
  onClose: () => void
  onOpenAnalysis: () => void
}> = ({ project, onClose, onOpenAnalysis }) => {
  const score = project.healthScore ?? 0
  const color = getScoreColor(score)
  const bg = getScoreBg(score)
  const delta = getDelta(project.lastSnapshot, project.prevSnapshot)
  const snapshots = project.snapshots ?? []

  const proFeatures = [
    { icon: <Activity size={13} />, label: 'Anomaly Detection', desc: 'Detects suspicious patterns in commits' },
    { icon: <AlertTriangle size={13} />, label: 'Instability Tracking', desc: 'Most modified and unstable files' },
    { icon: <Zap size={13} />, label: 'Pattern Consistency', desc: 'Naming, state, style vs rest of codebase' },
  ]

  const handleUpgrade = () => {
    if (openPricingUrl()) return
    window.alert('Billing is not yet configured in this build. Set VITE_PRICING_URL to enable upgrades.')
  }

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 380,
      background: 'var(--background)', boxShadow: 'var(--shadow-border)',
      display: 'flex', flexDirection: 'column', zIndex: 100,
      animation: 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    }}>
      <style>{`@keyframes slideIn { from { transform: translateX(20px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }`}</style>

      {/* Header */}
      <div style={{ padding: '20px 24px', borderBottom: `1px solid var(--border)`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>{project.name}</p>
          <p style={{ fontSize: 11, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
            {project.repo || project.path}
          </p>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, display: 'flex', padding: 4 }}
          onMouseEnter={e => (e.currentTarget.style.color = C.text)}
          onMouseLeave={e => (e.currentTarget.style.color = C.muted)}>
          <X size={15} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

        {/* Health Score */}
        <div style={{ background: bg, border: `1px solid ${color}22`, borderRadius: 'var(--radius)', padding: '24px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 24, boxShadow: 'var(--shadow-border)' }}>
          <ScoreRing score={score} size={64} />
          <div style={{ flex: 1 }}>
            <p className="section-label" style={{ marginBottom: 4 }}>Health Score</p>
            <p style={{ fontSize: 28, fontWeight: 700, color, fontFamily: 'var(--font-mono)', letterSpacing: '-0.05em' }}>{score}<span style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>/100</span></p>
            {delta !== null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                {delta > 0
                  ? <TrendingUp size={12} color={C.green} />
                  : delta < 0
                  ? <TrendingDown size={12} color={C.red} />
                  : <Minus size={12} color="var(--muted-foreground)" />
                }
                <span style={{ fontSize: 12, color: delta > 0 ? C.green : delta < 0 ? C.red : 'var(--muted-foreground)' }}>
                  {delta > 0 ? '+' : ''}{delta} since last analysis
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Degradation Detection — Free */}
        <div style={{ marginBottom: 20 }}>
          <p className="section-label" style={{ marginBottom: 12 }}>Degradation</p>

          {project.lastSnapshot ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {delta !== null && delta < -5 && (
                <div style={{ background: '#1f0d0d', border: '1px solid #3a1a1a', borderRadius: 6, padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <AlertTriangle size={13} color={C.red} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p style={{ fontSize: 12, color: C.red, fontWeight: 500, marginBottom: 2 }}>Degradation detected</p>
                    <p style={{ fontSize: 11, color: '#888' }}>Score dropped {Math.abs(delta)} points since last analysis.</p>
                  </div>
                </div>
              )}
              {delta !== null && delta >= 0 && (
                <div style={{ background: '#0d1f0d', border: '1px solid #1a3a1a', borderRadius: 6, padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <CheckCircle size={13} color={C.green} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p style={{ fontSize: 12, color: C.green, fontWeight: 500, marginBottom: 2 }}>No degradation</p>
                    <p style={{ fontSize: 11, color: '#888' }}>Stable or improving quality.</p>
                  </div>
                </div>
              )}

              {/* Last snapshot info */}
              <div className="card" style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className="section-label" style={{ fontSize: 9 }}>Last analysis</span>
                  <span style={{ fontSize: 10, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }}>
                    {project.lastSnapshot.timestamp ? new Date(project.lastSnapshot.timestamp).toLocaleDateString('en-US') : '—'}
                  </span>
                </div>
                {[
                  { label: 'Total issues', value: project.lastSnapshot.issueCount },
                  { label: 'High impact', value: project.lastSnapshot.high, color: C.red },
                  { label: 'Medium', value: project.lastSnapshot.medium, color: C.yellow },
                  { label: 'Low', value: project.lastSnapshot.low, color: 'var(--muted-foreground)' },
                ].map(({ label, value, color: vc }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{label}</span>
                    <span style={{ fontSize: 12, color: vc ?? 'var(--foreground)', fontWeight: 600 }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: '14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Clock size={13} color={C.muted} />
              <p style={{ fontSize: 12, color: C.muted }}>No analyses yet. Run the first one to start monitoring.</p>
            </div>
          )}
        </div>

        {/* Pro features — locked */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <p style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '1.2px' }}>Pro Features</p>
            <span style={{ fontSize: 9, color: C.blue, background: '#0d0d1f', border: `1px solid ${C.blue}33`, borderRadius: 4, padding: '2px 6px', fontWeight: 600 }}>PRO</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {proFeatures.map(({ icon, label, desc }) => (
              <div key={label} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 12px', opacity: 0.5, position: 'relative', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ color: C.muted }}>{icon}</span>
                  <span style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{label}</span>
                  <Lock size={10} color={C.muted} style={{ marginLeft: 'auto' }} />
                </div>
                <p style={{ fontSize: 11, color: C.muted, paddingLeft: 21 }}>{desc}</p>
              </div>
            ))}
          </div>
          <button onClick={handleUpgrade} className="btn btn-primary" style={{ width: '100%', marginTop: 12 }}>
            Upgrade to Pro
          </button>
          {!hasPricingUrl && (
            <p style={{ marginTop: 8, fontSize: 11, color: C.muted }}>
              Set `VITE_PRICING_URL` to enable this CTA.
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '16px 24px', borderTop: `1px solid var(--border)`, flexShrink: 0 }}>
        <button onClick={onOpenAnalysis} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Play size={14} /> Open Analysis</span>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}

// ─── Project Card ─────────────────────────────────────────────────────────────

const ProjectCard: React.FC<{
  project: ProjectWithHealth
  onClick: () => void
  onDelete: (e: React.MouseEvent) => void
  onAnalyse: (e: React.MouseEvent) => void
  selected: boolean
}> = ({ project, onClick, onDelete, onAnalyse, selected }) => {
  const [hovered, setHovered] = useState(false)
  const score = project.healthScore
  const color = score !== undefined ? getScoreColor(score) : C.muted
  const delta = getDelta(project.lastSnapshot, project.prevSnapshot)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="card"
      style={{
        background: selected ? 'var(--accent)' : 'var(--card)',
        padding: '20px', cursor: 'pointer',
        boxShadow: selected ? '0 0 0 1px var(--ring)' : 'var(--shadow-border)',
        position: 'relative',
      }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', marginBottom: 4, letterSpacing: '-0.02em' }}>{project.name}</p>
          <p style={{ fontSize: 11, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {project.repo || project.path}
          </p>
        </div>
        {score !== undefined && (
          <div style={{ flexShrink: 0, marginLeft: 12 }}>
            <ScoreRing score={score} size={40} />
          </div>
        )}
        {score === undefined && (
          <span style={{ fontSize: 10, color: C.muted, background: C.subtle, borderRadius: 4, padding: '3px 7px', flexShrink: 0 }}>
            Not analysed
          </span>
        )}
      </div>

      {/* Middle row — métricas */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span className="badge badge-muted" style={{ fontSize: 10, padding: '1px 6px' }}>
          <GitBranch size={9} /> {project.branch || 'main'}
        </span>
        {delta !== null && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: delta >= 0 ? C.green : C.red, fontWeight: 600 }}>
            {delta > 0 ? <TrendingUp size={10} /> : delta < 0 ? <TrendingDown size={10} /> : <Minus size={10} />}
            {delta > 0 ? '+' : ''}{delta}
          </span>
        )}
        {project.lastSnapshot && (
          <span className="section-label" style={{ fontSize: 9, marginLeft: 'auto', letterSpacing: '0.05em' }}>
            {project.lastSnapshot.issueCount} issues
          </span>
        )}
      </div>

      {/* Sparkline se tiver histórico */}
      {project.snapshots && project.snapshots.length >= 2 && (
        <div style={{ marginBottom: 12 }}>
          <Sparkline snapshots={project.snapshots} color={color} />
        </div>
      )}

      {/* Bottom row — actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: `1px solid var(--border)` }}>
        <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>
          {project.last_run ? `Last analysis ${new Date(project.last_run).toLocaleDateString('en-US')}` : 'Never analysed'}
        </span>
        <div style={{ display: 'flex', gap: 6, opacity: hovered ? 1 : 0, transition: 'opacity 0.12s ease' }}>
          <button
            onClick={onAnalyse}
            title="Run Analysis"
            className="btn btn-secondary btn-sm"
            style={{ height: 26, padding: '0 8px', fontSize: 10 }}
          >
            <Play size={10} /> Analyse
          </button>
          <button
            onClick={onDelete}
            title="Delete"
            className="btn btn-ghost btn-sm"
            style={{ height: 26, width: 26, padding: 0 }}
          >
            <Trash2 size={12} className="text-destructive" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface ProjectsPageProps {
  onOpenProject: (id: string) => void
}

export const ProjectsPage: React.FC<ProjectsPageProps> = ({ onOpenProject }) => {
  const [projects, setProjects] = useState<ProjectWithHealth[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedProject, setSelectedProject] = useState<ProjectWithHealth | null>(null)

  const loadProjects = async () => {
    setLoading(true)
    try {
      const p: Project[] = await getAllProjects()

      const enriched: ProjectWithHealth[] = await Promise.all(
        (p || []).map(async (proj) => {
          const snapshots: any[] = await getHealthSnapshots(proj.id)
          const [last, prev] = snapshots // mais recente primeiro
          return {
            ...proj,
            healthScore: last?.score,
            lastSnapshot: last ? {
              score: last.score,
              timestamp: last.timestamp,
              issueCount: last.issue_count,
              high: last.high,
              medium: last.medium,
              low: last.low,
            } : undefined,
            prevSnapshot: prev ? {
              score: prev.score,
              timestamp: prev.timestamp,
              issueCount: prev.issue_count,
              high: prev.high,
              medium: prev.medium,
              low: prev.low,
            } : undefined,
            snapshots: snapshots.reverse().map((s: any) => ({
              score: s.score,
              timestamp: s.timestamp,
              issueCount: s.issue_count,
              high: s.high,
              medium: s.medium,
              low: s.low,
            })),
          }
        })
      )

      setProjects(enriched)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  useEffect(() => { loadProjects() }, [])

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (confirm('Are you sure you want to delete this project?')) {
      await deleteProject(id)
      setProjects((prev: ProjectWithHealth[]) => prev.filter((p: ProjectWithHealth) => p.id !== id))
      if (selectedProject?.id === id) setSelectedProject(null)
    }
  }

  return (
    <div style={{ padding: '32px 36px', height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } } .spin { animation: spin 1s linear infinite; }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 4, fontSize: 28 }}>Projects</h1>
          <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>{projects.length} projeto{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} /> New Project
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#666', fontSize: 13, marginTop: 80, justifyContent: 'center' }}>
          <Loader2 size={14} className="spin" /> Loading projects...
        </div>
      ) : projects.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: 80 }}>
          <FolderOpen size={24} style={{ color: '#222' }} />
          <p style={{ fontSize: 13, color: '#333' }}>No projects yet</p>
          <button className="btn btn-primary" style={{ marginTop: 4 }} onClick={() => setShowModal(true)}>
            <Plus size={13} /> New Project
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 12,
          // Deixa espaço para o painel lateral quando aberto
          marginRight: selectedProject ? 372 : 0,
          transition: 'margin-right 0.2s ease',
        }}>
          {projects.map((p: ProjectWithHealth) => (
            <ProjectCard
              key={p.id}
              project={p}
              selected={selectedProject?.id === p.id}
              onClick={() => setSelectedProject((prev: ProjectWithHealth | null) => prev?.id === p.id ? null : p)}
              onDelete={(e: React.MouseEvent) => handleDelete(e, p.id)}
              onAnalyse={(e: React.MouseEvent) => { e.stopPropagation(); onOpenProject(p.id) }}
            />
          ))}

          {/* Add new card */}
          <button
            onClick={() => setShowModal(true)}
            className="card"
            style={{
              background: 'transparent', borderStyle: 'dashed',
              padding: '16px 18px', cursor: 'pointer', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 140,
            }}
          >
            <Plus size={24} className="text-muted-foreground" />
            <span className="section-label" style={{ fontSize: 10 }}>New project</span>
          </button>
        </div>
      )}

      {/* Monitor Panel */}
      {selectedProject && (
        <>
          {/* Overlay para fechar */}
          <div
            onClick={() => setSelectedProject(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 99 }}
          />
          <MonitorPanel
            project={selectedProject}
            onClose={() => setSelectedProject(null)}
            onOpenAnalysis={() => { setSelectedProject(null); onOpenProject(selectedProject.id) }}
          />
        </>
      )}

      {showModal && (
        <NewProjectModal
          onClose={() => setShowModal(false)}
          onProjectCreated={(project: Project) => {
            setProjects((prev: ProjectWithHealth[]) => [{ ...project }, ...prev])
            setShowModal(false)
            onOpenProject(project.id)
          }}
        />
      )}
    </div>
  )
}
