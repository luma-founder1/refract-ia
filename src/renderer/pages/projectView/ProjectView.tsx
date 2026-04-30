import React, { useState, useEffect } from 'react'
import {
  GitBranch, Play, GitPullRequest, Layout, Code2, ZapOff,
  FileText, Eye, ChevronLeft, ChevronRight, Check, X,
  Settings2, CheckCircle2, ArrowLeft, Download, Folder,
  File as FileIcon, CheckCheck, Sparkles
} from 'lucide-react'
import { IPC_CHANNELS, Project, AnalysisResult, IssueCategory, AnalysisIssue, ApplyResult } from '../../../shared/ipc'
import { CodeMap } from './CodeMap'
import type { DiffLine, Phase, Decision } from './types'

// ─── Constants ────────────────────────────────────────────────────────────────
const C = {
  bg: '#0a0a0a', surface: '#111111', surfaceHover: '#141414',
  border: '#1a1a1a', borderHover: '#2a2a2a', text: '#ffffff',
  muted: '#444444', subtle: '#222222', blue: '#3B82F6',
  blueHover: '#2563eb', blueDim: '#0d1a2e', green: '#4ade80', red: '#ef4444',
}

const CATEGORY_META: Record<IssueCategory, { name: string; icon: string; impact: 'High' | 'Medium' | 'Low' }> = {
  'oversized-component': { name: 'Oversized Components', icon: 'layout',    impact: 'High'   },
  'any-type':            { name: 'Any Types',            icon: 'code2',     impact: 'High'   },
  'dead-state':          { name: 'Dead useState',        icon: 'zap-off',   impact: 'Medium' },
  'missing-docs':        { name: 'Missing Docs',         icon: 'file-text', impact: 'Low'    },
}

// ─── Sub-components ───────────────────────────────────────────────────────────
const CategoryIcon: React.FC<{ name: string; color?: string }> = ({ name, color = C.muted }) => {
  const props = { size: 14, color }
  switch (name) {
    case 'layout':    return <Layout    {...props} />
    case 'code2':     return <Code2     {...props} />
    case 'zap-off':   return <ZapOff    {...props} />
    case 'file-text': return <FileText  {...props} />
    default:          return <FileText  {...props} />
  }
}

const ImpactBadge: React.FC<{ level: 'High' | 'Medium' | 'Low' }> = ({ level }) => {
  const styles: Record<string, React.CSSProperties> = {
    High:   { background: '#1f0d0d', color: C.red,     border: '1px solid #3a1a1a' },
    Medium: { background: '#1a1500', color: '#facc15', border: '1px solid #2a2200' },
    Low:    { background: '#0d0d0d', color: '#444',    border: `1px solid ${C.border}` },
  }
  return (
    <span style={{ ...styles[level], fontSize: 10, borderRadius: 4, padding: '1px 6px', fontWeight: 500 }}>
      {level} impact
    </span>
  )
}

const DiffLineRow: React.FC<DiffLine> = ({ num, content, type }) => {
  const bg = type === 'removed' ? '#1f0d0d' : type === 'added' ? '#0d1f0d' : 'transparent'
  const color = type === 'removed' ? C.red : type === 'added' ? C.green : C.muted
  const bl = type === 'removed' ? `2px solid ${C.red}` : type === 'added' ? `2px solid ${C.green}` : '2px solid transparent'
  return (
    <div style={{ display: 'flex', background: bg, borderLeft: bl, minHeight: 22 }}>
      <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: C.subtle, minWidth: 28, textAlign: 'right', paddingRight: 12, paddingLeft: 4, userSelect: 'none', lineHeight: '22px', flexShrink: 0 }}>
        {num}
      </span>
      <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 12, color, lineHeight: '22px', whiteSpace: 'pre', paddingRight: 16 }}>
        {content || ' '}
      </span>
    </div>
  )
}

// ─── Analysing panel ──────────────────────────────────────────────────────────
const AnalysingPanel: React.FC<{ files: any[]; scannedFiles: string[]; activeFile: string | null }> = ({ files, scannedFiles, activeFile }) => (
  <div style={{ padding: '24px', width: '100%' }}>
    <p style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>A analisar ficheiros do projecto...</p>
    <style>{'@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }'}</style>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {files.filter(f => !f.isDirectory).map(f => {
        const done = scannedFiles.includes(f.path)
        const active = activeFile === f.path
        return (
          <div key={f.path} style={{ height: 28, display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', borderRadius: 4, background: active ? '#0d1a2e' : done ? '#0d0d0d' : 'transparent', border: `1px solid ${active ? C.blue : done ? '#1a1a1a' : 'transparent'}`, transition: 'all 0.15s ease' }}>
            <FileIcon size={11} color={done ? C.blue : C.muted} />
            <span style={{ fontSize: 11, color: done ? '#fff' : '#333', fontFamily: 'Geist Mono, monospace', flex: 1 }}>
              {f.name}
            </span>
            {active && <span style={{ fontSize: 9, color: C.blue, letterSpacing: '0.8px' }}>SCANNING</span>}
            {done && !active && <Check size={10} color={C.blue} />}
            {!done && !active && (
              <div style={{ height: 6, width: 60, borderRadius: 3, background: 'linear-gradient(90deg, #1a1a1a 25%, #222 50%, #1a1a1a 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
            )}
          </div>
        )
      })}
    </div>
  </div>
)

// ─── Briefing panel ───────────────────────────────────────────────────────────
const BriefingPanel: React.FC<{ text: string; onStart: () => void }> = ({ text, onStart }) => {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    setDisplayed('')
    setDone(false)
    let i = 0
    const interval = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) {
        clearInterval(interval)
        setDone(true)
      }
    }, 18)
    return () => clearInterval(interval)
  }, [text])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '0 48px', gap: 28 }}>
      <div style={{ width: 36, height: 36, background: C.blueDim, border: `1px solid ${C.blue}`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Sparkles size={16} color={C.blue} />
      </div>
      <p style={{ fontSize: 14, color: '#ccc', lineHeight: 1.8, textAlign: 'center', maxWidth: 520, minHeight: 80 }}>
        {displayed}
        {!done && <span style={{ opacity: 0.5, animation: 'blink 1s infinite' }}>|</span>}
      </p>
      <style>{'@keyframes blink { 0%,100% { opacity: 0 } 50% { opacity: 1 } }'}</style>
      {done && (
        <button
          onClick={onStart}
          style={{ height: 36, padding: '0 20px', background: C.blue, color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'background 0.12s ease' }}
          onMouseEnter={e => (e.currentTarget.style.background = C.blueHover)}
          onMouseLeave={e => (e.currentTarget.style.background = C.blue)}
        >
          {'Comecar a rever ->'}
        </button>
      )}
    </div>
  )
}

// ─── Success state ────────────────────────────────────────────────────────────
const SuccessState: React.FC<{
  summary: AnalysisResult['summary']
  decisions: Record<string, Decision>
  issues: AnalysisIssue[]
  projectPath: string
  onReviewAgain: () => void
}> = ({ summary, decisions, issues, projectPath, onReviewAgain }) => {
  const [applying, setApplying]       = useState(false)
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null)

  const accepted = Object.entries(decisions).filter(([, d]) => d === 'accepted').length
  const rejected = Object.entries(decisions).filter(([, d]) => d === 'rejected').length

  const handleApply = async () => {
    setApplying(true)
    const acceptedIssues = issues.filter(i => decisions[i.id] === 'accepted')
    try {
      const result = await window.electron.invoke(IPC_CHANNELS.APPLY_CHANGES, {
        projectPath,
        issues: acceptedIssues,
      })
      setApplyResult(result)
    } catch (err) {
      setApplyResult({ success: false, error: String(err) })
    } finally {
      setApplying(false)
    }
  }

  const metrics = [
    { label: 'Issues encontrados', value: summary.total },
    { label: 'Aceites',            value: accepted       },
    { label: 'Rejeitados',         value: rejected       },
    { label: 'High impact',        value: summary.high  },
  ]

  return (
    <div style={{ padding: '40px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      <CheckCircle2 size={32} color={C.green} style={{ marginBottom: 16 }} />
      <h2 style={{ fontSize: 20, fontWeight: 600, color: '#fff', letterSpacing: '-0.4px', marginBottom: 6 }}>Refract completo.</h2>
      <p style={{ fontSize: 13, color: C.muted, marginBottom: 32 }}>Revisaste {Object.keys(decisions).length} sugestões.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, width: '100%', marginBottom: 36 }}>
        {metrics.map(m => (
          <div key={m.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 600, color: '#fff', marginBottom: 4 }}>{m.value}</div>
            <div style={{ fontSize: 10, color: '#333', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* Apply result */}
      {applyResult && (
        <div style={{ width: '100%', marginBottom: 24, padding: '16px', background: applyResult.success ? '#0d1f0d' : '#1f0d0d', border: `1px solid ${applyResult.success ? '#1a3a1a' : '#3a1a1a'}`, borderRadius: 8 }}>
          {applyResult.success ? (
            <>
              <p style={{ fontSize: 12, color: C.green, marginBottom: 8, fontWeight: 500 }}>✓ Alterações aplicadas com sucesso</p>
              <p style={{ fontSize: 11, color: '#666', fontFamily: 'Geist Mono, monospace' }}>Branch: {applyResult.branch}</p>
              <p style={{ fontSize: 11, color: '#666', fontFamily: 'Geist Mono, monospace' }}>Commit: {applyResult.commitHash?.slice(0, 7)}</p>
              <p style={{ fontSize: 11, color: '#666', marginTop: 4 }}>{applyResult.filesChanged?.length} ficheiro(s) alterado(s)</p>
            </>
          ) : (
            <p style={{ fontSize: 12, color: C.red }}>{applyResult.error}</p>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        {!applyResult?.success && accepted > 0 && (
          <button onClick={handleApply} disabled={applying}
            style={{ height: 36, padding: '0 18px', background: applying ? '#1a1a1a' : C.blue, color: applying ? C.muted : '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: applying ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.12s ease' }}>
            <GitPullRequest size={13} /> {applying ? 'A aplicar...' : `Apply ${accepted} change${accepted !== 1 ? 's' : ''}`}
          </button>
        )}
        <button style={{ height: 36, padding: '0 18px', background: C.surface, color: '#fff', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Download size={13} /> Export Changelog
        </button>
        <button onClick={onReviewAgain}
          style={{ height: 36, padding: '0 18px', background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={e => (e.currentTarget.style.color = C.muted)}>
          Rever novamente
        </button>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export interface ProjectViewProps { projectId: string | null; onBack: () => void }

export const ProjectView: React.FC<ProjectViewProps> = ({ projectId, onBack }) => {
  const [phase, setPhase] = useState<Phase>('idle')
  const [project, setProject] = useState<Project | null>(null)
  const [files, setFiles] = useState<any[]>([])
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [briefingText, setBriefingText] = useState('')
  const [selectedCat, setSelectedCat] = useState<IssueCategory | null>(null)
  const [currentIssueIdx, setCurrentIssueIdx] = useState(0)
  const [decisions, setDecisions] = useState<Record<string, Decision>>({})
  const [flashId, setFlashId] = useState<string | null>(null)
  const [flashType, setFlashType] = useState<Decision | null>(null)
  const [refineOpen, setRefineOpen] = useState(false)
  const [refineText, setRefineText] = useState('')
  const [scannedFiles, setScannedFiles] = useState<string[]>([])
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [issueExplanation, setIssueExplanation] = useState<string | null>(null)
const [loadingExplanation, setLoadingExplanation] = useState(false)
const [explanationCache, setExplanationCache] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState<'analysis' | 'codemap'>('analysis')
  const [hoveredFile, setHoveredFile] = useState<string | null>(null)

  // Derived
  const allIssues = result?.issues ?? []
  const visibleIssues = selectedCat ? allIssues.filter(i => i.category === selectedCat) : allIssues
  const currentIssue = visibleIssues[currentIssueIdx] ?? null

  const categories = result
    ? (Object.keys(CATEGORY_META) as IssueCategory[]).map(cat => {
        const catIssues = allIssues.filter(i => i.category === cat)
        const accepted = catIssues.filter(i => decisions[i.id] === 'accepted').length
        const rejected = catIssues.filter(i => decisions[i.id] === 'rejected').length
        return { cat, meta: CATEGORY_META[cat], count: catIssues.length, accepted, rejected }
      }).filter(c => c.count > 0)
    : []



  useEffect(() => {
    if (!currentIssue) return;
    
    if (explanationCache[currentIssue.id]) {
      setIssueExplanation(explanationCache[currentIssue.id]);
      setLoadingExplanation(false);
      return;
    }

    setIssueExplanation(null);
    setLoadingExplanation(true);
    
    const issueId = currentIssue.id;
    const issuePath = currentIssue.filePath;
    const issueProblem = currentIssue.problem;

    async function getExplanation() {
      try {
        const fileSource = await window.electron.invoke(IPC_CHANNELS.READ_FILE, issuePath);
        const explanation = await window.electron.invoke(IPC_CHANNELS.EXPLAIN_ISSUE, currentIssue, fileSource);
        setIssueExplanation(explanation);
        setExplanationCache(prev => ({ ...prev, [issueId]: explanation }));
      } catch (err) {
        setIssueExplanation(issueProblem);
      } finally {
        setLoadingExplanation(false);
      }
    }
    getExplanation();
  }, [currentIssue?.id]);

  useEffect(() => {
    async function load() {
      if (!projectId) return
      try {
        const p = await window.electron.invoke(IPC_CHANNELS.GET_PROJECT, projectId)
        setProject(p)
        if (p?.path) {
          const tree = await window.electron.invoke(IPC_CHANNELS.GET_FILE_TREE, p.path)
          setFiles(tree || [])
        }
      } catch (err) { console.error('Failed to load project', err) }
    }
    load()
  }, [projectId])


  // Flash animation helper
  const triggerFlash = (id: string, type: Decision) => {
    setFlashId(id)
    setFlashType(type)
    setTimeout(() => {
      setFlashId(null)
      setFlashType(null)
    }, 400)
  }

  // Navigate to next issue
  const advance = () => {
    setRefineOpen(false)
    setRefineText('')
    const next = currentIssueIdx + 1
    if (next >= visibleIssues.length) setPhase('complete')
    else setCurrentIssueIdx(next)
  }

  const handleAccept = () => {
    if (!currentIssue) return
    triggerFlash(currentIssue.id, 'accepted')
    setDecisions(prev => ({ ...prev, [currentIssue.id]: 'accepted' }))
    setTimeout(advance, 350)
  }

  const handleReject = () => {
    if (!currentIssue) return
    triggerFlash(currentIssue.id, 'rejected')
    setDecisions(prev => ({ ...prev, [currentIssue.id]: 'rejected' }))
    setTimeout(advance, 350)
  }

  const handleAcceptAll = () => {
    const all: Record<string, Decision> = {}
    allIssues.forEach(i => { all[i.id] = 'accepted' })
    setDecisions(all)
    setPhase('complete')
  }

  // Run analysis
  const runAnalysis = async () => {
    if (!project?.path) return
    setPhase('analysing')
    setDecisions({})
    setScannedFiles([])
    setActiveFile(null)

    const flatFiles = files.filter(f => !f.isDirectory)
    flatFiles.forEach((f, i) => {
      setTimeout(() => {
        setActiveFile(f.path)
        setScannedFiles(prev => [...prev, f.path])
        if (i === flatFiles.length - 1) setActiveFile(null)
      }, i * 150)
    })

    try {
      const analysisResult: AnalysisResult = await window.electron.invoke(IPC_CHANNELS.RUN_ANALYSIS, project.path)
      const visualDuration = flatFiles.length * 150 + 600

      setTimeout(async () => {
        setResult(analysisResult)
        try {
          const briefing = await window.electron.invoke(
            IPC_CHANNELS.GENERATE_BRIEFING,
            {
              projectPath: project.path,
              issues: analysisResult.issues,
              scannedFiles: analysisResult.scannedFiles,
            }
          )
          setBriefingText(briefing ?? `Analisei ${analysisResult.scannedFiles.length} ficheiros e encontrei ${analysisResult.summary.total} problemas.`)
        } catch (err) {
          setBriefingText(`Analisei ${analysisResult.scannedFiles.length} ficheiros e encontrei ${analysisResult.summary.total} problemas.`)
        }
        setSelectedCat(analysisResult.issues[0]?.category ?? null)
        setCurrentIssueIdx(0)
        setPhase('briefing')
      }, visualDuration)
    } catch (err) {
      console.error('Analysis failed', err)
      setPhase('idle')
    }
  }

  const buildDiffLines = (lines: string[], type: 'removed' | 'added'): DiffLine[] =>
    lines.map((content, i) => ({ num: i + 1, content, type }))

  // Flash overlay colour
  const flashBg = flashType === 'accepted' ? 'rgba(74,222,128,0.06)' : flashType === 'rejected' ? 'rgba(239,68,68,0.06)' : 'transparent'

  // ── Top bar ──────────────────────────────────────────────────────────────
  const TopBar = (
    <div style={{ height: 48, background: C.bg, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', gap: 16, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, display: 'flex', alignItems: 'center', padding: 0 }}
          onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={e => (e.currentTarget.style.color = C.muted)}>
          <ArrowLeft size={15} />
        </button>
        <span style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>{project?.name ?? 'Loading...'}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 4, padding: '2px 6px' }}>
          <GitBranch size={9} /> {project?.branch ?? 'main'}
        </span>
        {result && <span style={{ fontSize: 11, color: '#333' }}>{result.summary.total} issues</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, flex: 1, justifyContent: 'center' }}>
        {[
          { id: 'analysis', label: 'Analysis', icon: <Eye size={13} /> },
          { id: 'codemap',  label: 'CodeMap',  icon: <GitBranch size={13} /> },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: activeTab === tab.id ? C.blue : C.muted, padding: '16px 0', position: 'relative', transition: 'color 0.2s' }}>
            {tab.icon} {tab.label}
            {activeTab === tab.id && (
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: C.blue, borderRadius: '2px 2px 0 0' }} />
            )}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {phase === 'reviewing' && (
          <button onClick={handleAcceptAll}
            style={{ height: 30, padding: '0 14px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.12s ease' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.green; e.currentTarget.style.color = C.green }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted }}>
            <CheckCheck size={11} /> Accept All
          </button>
        )}
        <button onClick={runAnalysis}
          style={{ height: 30, padding: '0 14px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = C.blue; e.currentTarget.style.color = C.blue }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = '#fff' }}>
          <Play size={11} /> Run Analysis
        </button>
        {phase === 'reviewing' && (
          <button style={{ height: 30, padding: '0 14px', background: C.blue, border: 'none', borderRadius: 5, fontSize: 12, fontWeight: 500, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            onMouseEnter={e => (e.currentTarget.style.background = C.blueHover)}
            onMouseLeave={e => (e.currentTarget.style.background = C.blue)}>
            <GitPullRequest size={11} /> Generate PR
          </button>
        )}
      </div>
    </div>
  )

  // ── Left panel ────────────────────────────────────────────────────────────
  const LeftPanel = (
    <div style={{ width: 260, flexShrink: 0, background: C.bg, borderRight: `1px solid ${C.border}`, overflowY: 'auto', padding: '16px 12px' }}>

      {phase === 'reviewing' && categories.length > 0 && (
        <>
          <p style={{ fontSize: 10, color: '#333', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: 12 }}>Issues</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {categories.map(({ cat, meta, count, accepted, rejected }) => {
              const active = selectedCat === cat
              const reviewed = accepted + rejected
              const pct = count > 0 ? (reviewed / count) * 100 : 0
              return (
                <div key={cat} onClick={() => { setSelectedCat(cat); setCurrentIssueIdx(0) }}
                  style={{ background: active ? C.blueDim : C.surface, border: `1px solid ${active ? C.blue : C.border}`, borderRadius: 6, padding: '12px 14px', cursor: 'pointer', transition: 'all 0.12s ease' }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = '#141414' }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = C.surface }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <CategoryIcon name={meta.icon} />
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#fff', flex: 1 }}>{meta.name}</span>
                    <span style={{ fontSize: 10, color: C.muted, background: C.border, borderRadius: 10, padding: '1px 6px' }}>{count}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <ImpactBadge level={meta.impact} />
                    {reviewed > 0 && (
                      <span style={{ fontSize: 9, color: '#333' }}>{reviewed}/{count} revisto{reviewed !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                  {reviewed > 0 && (
                    <div style={{ marginTop: 8, height: 2, background: '#1a1a1a', borderRadius: 1, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: C.blue, borderRadius: 1, transition: 'width 0.3s ease' }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* File tree */}
      <div style={{ borderTop: phase === 'reviewing' ? '1px solid #111' : 'none', paddingTop: phase === 'reviewing' ? 12 : 0 }}>
        <p style={{ fontSize: 10, color: '#333', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: 12 }}>Project Files</p>
        {files.length === 0
          ? <span style={{ fontSize: 11, color: C.muted, paddingLeft: 6 }}>No files found.</span>
          : files.map(f => (
            <div key={f.path}
              onMouseEnter={() => setHoveredFile(f.path)}
              onMouseLeave={() => setHoveredFile(null)}
              style={{ height: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 6px', borderRadius: 4, background: hoveredFile === f.path ? '#111' : 'transparent', cursor: 'pointer', transition: 'background 0.12s ease' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                {f.isDirectory ? <Folder size={11} color={C.muted} /> : <FileIcon size={11} color={C.muted} />}
                <span style={{ fontSize: 11, color: f.isDirectory ? '#ddd' : C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.name}
                </span>
              </div>
              {hoveredFile === f.path && !f.isDirectory && (
                <button style={{ width: 18, height: 18, background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 3, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Eye size={10} color={C.muted} />
                </button>
              )}
            </div>
          ))
        }
      </div>
    </div>
  )

  // ── Center panel ──────────────────────────────────────────────────────────
  const CenterPanel = (
    <div style={{ flex: 1, background: flashId ? flashBg : C.bg, overflowY: 'auto', padding: phase === 'idle' || phase === 'briefing' ? 0 : '20px 24px', display: 'flex', flexDirection: 'column', transition: 'background 0.3s ease' }}>

      {phase === 'idle' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
          <Play size={28} color={C.muted} />
          <p style={{ fontSize: 14, color: C.muted }}>Corre a analise para detectar problemas</p>
          <button onClick={runAnalysis}
            style={{ height: 34, padding: '0 18px', background: C.blue, color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.background = C.blueHover)}
            onMouseLeave={e => (e.currentTarget.style.background = C.blue)}>
            Run Analysis
          </button>
        </div>
      )}

      {phase === 'analysing' && (
        <AnalysingPanel files={files} scannedFiles={scannedFiles} activeFile={activeFile} />
      )}

      {phase === 'briefing' && result && (
        <BriefingPanel text={briefingText} onStart={() => setPhase('reviewing')} />
      )}

      {phase === 'reviewing' && currentIssue && (
        <>
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: C.muted, marginBottom: 6 }}>{currentIssue.filePath}</p>
            <p style={{ fontSize: 12, color: '#fff' }}>{currentIssue.problem}</p>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            {[
              { title: 'Before', lines: buildDiffLines(currentIssue.lines.before, 'removed'), col: C.red },
              { title: 'After', lines: buildDiffLines(currentIssue.lines.after, 'added'), col: C.green },
            ].map(({ title, lines, col }) => (
              <div key={title} style={{ flex: 1, background: '#0d0d0d', border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', minWidth: 0 }}>
                <div style={{ height: 32, borderBottom: `1px solid ${C.border}`, padding: '0 14px', display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: col, textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 500 }}>{title}</span>
                </div>
                <div style={{ padding: '10px 0', overflowX: 'auto' }}>
                  {lines.map(l => <DiffLineRow key={l.num} {...l} />)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {(phase === 'reviewing' && !currentIssue && result) || (phase === 'complete' && result) ? (
        <SuccessState
          summary={result.summary}
          decisions={decisions}
          issues={allIssues}
          projectPath={project?.path ?? ''}
          onReviewAgain={() => { setPhase('idle'); setResult(null); setDecisions({}) }}
        />
      ) : null}
    </div>
  )

  // ── Right panel ───────────────────────────────────────────────────────────
  const RightPanel = phase !== 'reviewing' ? null : (
    <div style={{ width: 280, flexShrink: 0, background: C.bg, borderLeft: `1px solid ${C.border}`, overflowY: 'auto', padding: '20px 16px' }}>
      {currentIssue && (
        <>
          <p style={{ fontSize: 10, color: '#333', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: 10 }}>Porque</p>
          <p style={{ fontSize: 12, color: loadingExplanation ? C.muted : '#888', lineHeight: 1.6, marginBottom: 20, fontStyle: loadingExplanation ? 'italic' : 'normal' }}>
  {loadingExplanation ? 'A analisar...' : (issueExplanation ?? currentIssue.problem)}
</p>

          <p style={{ fontSize: 10, color: '#333', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: 12 }}>Impacto</p>
          {[
            { label: 'Severidade', value: currentIssue.impact, valueColor: currentIssue.impact === 'High' ? C.red : currentIssue.impact === 'Medium' ? '#facc15' : C.muted },
            { label: 'Linhas', value: String(currentIssue.lineEnd - currentIssue.lineStart + 1), valueColor: C.muted },
            { label: 'Ficheiro', value: currentIssue.file, valueColor: C.muted },
          ].map(({ label, value, valueColor }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: C.muted }}>{label}</span>
              <span style={{ fontSize: 11, color: valueColor, maxWidth: 140, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{value}</span>
            </div>
          ))}

          <div style={{ borderTop: `1px solid ${C.border}`, margin: '20px 0' }} />

          <button onClick={handleAccept}
            style={{ width: '100%', height: 36, background: C.green, color: '#000', fontWeight: 600, fontSize: 13, border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8, transition: 'background 0.12s ease' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#22c55e')}
            onMouseLeave={e => (e.currentTarget.style.background = C.green)}>
            <Check size={14} /> Accept
          </button>

          <button onClick={handleReject}
            style={{ width: '100%', height: 36, background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8, transition: 'all 0.12s ease' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.red; e.currentTarget.style.color = C.red }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted }}>
            <X size={14} /> Reject
          </button>


          <button onClick={() => setRefineOpen(o => !o)}
            style={{ width: '100%', height: 36, background: 'transparent', color: refineOpen ? C.blue : C.muted, border: `1px solid ${refineOpen ? C.blue : C.border}`, borderRadius: 6, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.12s ease' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.blue; e.currentTarget.style.color = C.blue }}
            onMouseLeave={e => {
              if (!refineOpen) {
                e.currentTarget.style.borderColor = C.border
                e.currentTarget.style.color = C.muted
              }
            }}>
            <Settings2 size={13} /> Refine
          </button>

          {refineOpen && (
            <div style={{ marginTop: 10 }}>
              <textarea
                value={refineText}
                onChange={e => setRefineText(e.target.value)}
                placeholder="Descreve o que queres ajustar nesta sugestao..."
                style={{ width: '100%', minHeight: 80, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 11, color: '#ccc', resize: 'vertical', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
              />
              <button
                style={{ marginTop: 6, width: '100%', height: 30, background: C.blueDim, border: `1px solid ${C.blue}`, borderRadius: 5, fontSize: 11, color: C.blue, cursor: 'pointer' }}>
                {'Enviar refinamento ->'}
              </button>
            </div>
          )}

          <div style={{ marginTop: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button onClick={() => setCurrentIssueIdx(i => Math.max(0, i - 1))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#333', display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}
              onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={e => (e.currentTarget.style.color = '#333')}>
              <ChevronLeft size={13} /> Prev
            </button>
            <span style={{ fontSize: 11, color: '#222' }}>{currentIssueIdx + 1} / {visibleIssues.length}</span>
            <button onClick={() => setCurrentIssueIdx(i => Math.min(visibleIssues.length - 1, i + 1))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#333', display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}
              onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={e => (e.currentTarget.style.color = '#333')}>
              Next <ChevronRight size={13} />
            </button>
          </div>
        </>
      )}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: C.bg, overflow: 'hidden' }}>
      {TopBar}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {activeTab === 'analysis' && LeftPanel}
        {activeTab === 'analysis' ? CenterPanel : <CodeMap projectPath={project?.path} issues={allIssues} />}
        {activeTab === 'analysis' && RightPanel}
      </div>
    </div>
  )
}
