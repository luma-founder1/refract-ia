import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from 'dagre'
import { FileCode, FileText, Package, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react'
import type { AnalysisIssue } from '../../shared/types'

// ─── Constants ────────────────────────────────────────────────────────────────
const C = {
  bg: '#0a0a0a',
  surface: '#111111',
  border: '#1a1a1a',
  blue: '#3B82F6',
  muted: '#444444',
  text: '#ffffff',
  green: '#4ade80',
  yellow: '#facc15',
  red: '#ef4444',
}

// ─── Layout ───────────────────────────────────────────────────────────────────
function applyDagreLayout(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  // Aumentado ranksep e nodesep para os nós "respirarem"
  g.setGraph({ rankdir: 'TB', ranksep: 120, nodesep: 80 })

  // Usando dimensões mais próximas da realidade do componente renderizado
  nodes.forEach(n => g.setNode(n.id, { width: 220, height: 80 }))
  edges.forEach(e => g.setEdge(e.source, e.target))

  dagre.layout(g)

  return nodes.map(n => {
    const pos = g.node(n.id)
    return { 
      ...n, 
      position: { 
        x: pos?.x != null ? pos.x - 110 : 0, 
        y: pos?.y != null ? pos.y - 40 : 0 
      } 
    }
  })
}

// ─── Health helpers ───────────────────────────────────────────────────────────
type Health = 'good' | 'warning' | 'critical'

const path = {
  posix: {
    join: (...parts: string[]) => parts.join('/').replace(/\/+/g, '/'),
  },
  basename: (p: string) => p.replace(/\\/g, '/').split('/').pop() ?? p,
}

function issueMatchesFile(issue: AnalysisIssue, relativeNodePath: string, projectPath: string): boolean {
  const norm = (s: string) => s.replace(/\\/g, '/').toLowerCase()
  const absExpected = norm(path.posix.join(projectPath.replace(/\\/g, '/'), relativeNodePath))
  const absIssue = norm(issue.filePath.replace(/\\/g, '/'))
  return absExpected === absIssue || absIssue.endsWith('/' + norm(relativeNodePath))
}

function getHealth(relativeNodePath: string, issues: AnalysisIssue[], projectPath: string): Health {
  const fileIssues = issues.filter(i => issueMatchesFile(i, relativeNodePath, projectPath))
  if (fileIssues.length === 0) return 'good'
  if (fileIssues.some(i => i.impact === 'High')) return 'critical'
  return 'warning'
}

function getFileIssues(relativeNodePath: string, issues: AnalysisIssue[], projectPath: string): AnalysisIssue[] {
  return issues.filter(i => issueMatchesFile(i, relativeNodePath, projectPath))
}

const HEALTH_COLOR: Record<Health, string> = {
  good:     C.green,
  warning:  C.yellow,
  critical: C.red,
}

const HEALTH_BG: Record<Health, string> = {
  good:     '#0d1f0d',
  warning:  '#1a1500',
  critical: '#1f0d0d',
}

// ─── Custom Node ──────────────────────────────────────────────────────────────
const FileNode = ({ data }: { data: any }) => {
  const { label, health, issueCount, selected, isolated } = data
  const fileName = path.basename(label)
  const isComponent = /\.(tsx|jsx)$/.test(fileName)
  const isType = /\.ts$/.test(fileName) && !isComponent
  const color = HEALTH_COLOR[health as Health]
  const bg = HEALTH_BG[health as Health]

  return (
    <div style={{
      background: selected ? bg : C.surface,
      border: `1px solid ${selected ? color : health === 'good' ? C.border : color}`,
      borderRadius: 8,
      padding: '10px 14px',
      minWidth: 200,
      maxWidth: 240,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      boxShadow: health !== 'good' ? `0 0 15px ${color}15` : 'none',
      opacity: isolated ? 0.4 : 1,
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      cursor: 'pointer',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: '#333', border: 'none', width: 6, height: 6 }} />

      <div style={{ width: 32, height: 32, borderRadius: 8, background: '#161616', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {isComponent
          ? <FileCode size={16} color={color} />
          : isType
          ? <Package size={16} color={C.blue} />
          : <FileText size={16} color={C.muted} />
        }
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {fileName}
        </div>
        <div style={{ fontSize: 10, color: C.muted, fontFamily: 'monospace', opacity: 0.6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </div>
      </div>

      {health !== 'good' && (
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, background: `${color}15`, padding: '2px 6px', borderRadius: 4 }}>
          {health === 'critical'
            ? <AlertTriangle size={12} color={C.red} />
            : <AlertCircle size={12} color={C.yellow} />
          }
          <span style={{ fontSize: 10, color, fontWeight: 700 }}>{issueCount}</span>
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ background: '#333', border: 'none', width: 6, height: 6 }} />
    </div>
  )
}

// ─── Internal Component ───────────────────────────────────────────────────────
const CodeMapInner: React.FC<CodeMapProps> = ({ projectPath, issues }) => {
  const { fitView } = useReactFlow()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [selectedIssues, setSelectedIssues] = useState<AnalysisIssue[]>([])
  const [unresolvedCount, setUnresolvedCount] = useState(0)
  const [truncated, setTruncated] = useState(false)

  const nodeTypes = useMemo(() => ({ file: FileNode }), [])

  useEffect(() => {
    if (!projectPath) return
    setLoading(true)
    setError(null)
    setSelectedFile(null)
    setUnresolvedCount(0)
    setTruncated(false)

    // Dependency analysis not available in web version yet
    // Requires file system access to parse imports
    setError('Mapa de dependências não disponível na versão web.')
    setLoading(false)
  }, [projectPath])

  const onNodeClick = useCallback((_: any, node: Node) => {
    const fileIssues = projectPath ? getFileIssues(node.id, issues, projectPath) : []
    setSelectedFile(node.id)
    setSelectedIssues(fileIssues)
    setNodes((ns) => ns.map((n) => ({
      ...n,
      data: { ...n.data, selected: n.id === node.id },
    })))
  }, [issues, projectPath, setNodes])

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, color: C.muted, fontSize: 12 }}>
      A mapear dependências...
    </div>
  )

  if (error) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, color: C.muted, fontSize: 12 }}>
      {error}
    </div>
  )

  return (
    <div style={{ flex: 1, height: '100%', background: C.bg, position: 'relative' }}>
      {(truncated || unresolvedCount > 0) && (
        <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 100, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', color: C.muted, fontSize: 11 }}>
          {truncated && <div>Mapa parcial: limite de ficheiros atingido.</div>}
          {unresolvedCount > 0 && <div>{unresolvedCount} import(s) não resolvido(s).</div>}
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        minZoom={0.05}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#161616" gap={24} variant={BackgroundVariant.Dots} />
        <Controls showInteractive={false} style={{ background: C.surface, border: `1px solid ${C.border}` }} />
        <MiniMap style={{ background: C.surface, border: `1px solid ${C.border}` }} nodeColor={(n: any) => HEALTH_COLOR[n.data.health as Health]} />
      </ReactFlow>

      {/* Selected Side Panel */}
      {selectedFile && (
        <div style={{ position: 'absolute', top: 16, right: 16, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, width: 280, zIndex: 100, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
          <p style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>File</p>
          <p style={{ fontSize: 12, color: C.text, fontWeight: 600, marginBottom: 12, wordBreak: 'break-all' }}>{selectedFile}</p>
          
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
            {selectedIssues.length === 0 ? (
              <p style={{ fontSize: 11, color: C.green }}>✓ Clean file</p>
            ) : (
              selectedIssues.map(i => (
                <div key={i.id} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: i.impact === 'High' ? C.red : C.yellow, marginTop: 4, flexShrink: 0 }} />
                  <p style={{ fontSize: 11, color: '#aaa', lineHeight: 1.4 }}>{i.problem}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Export with Provider ────────────────────────────────────────────────
interface CodeMapProps {
  projectPath?: string
  issues: AnalysisIssue[]
}

export const CodeMap: React.FC<CodeMapProps> = (props) => (
  <ReactFlowProvider>
    <CodeMapInner {...props} />
  </ReactFlowProvider>
)
