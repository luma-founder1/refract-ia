import React, { useEffect, useState, useCallback } from 'react'
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
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from 'dagre'
import { FileCode, FileText, Package, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react'
import { IPC_CHANNELS } from '../../../shared/ipc'
import type { AnalysisIssue } from '../../../shared/ipc'

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
  g.setGraph({ rankdir: 'TB', ranksep: 80, nodesep: 40 })

  nodes.forEach(n => g.setNode(n.id, { width: 200, height: 60 }))
  edges.forEach(e => g.setEdge(e.source, e.target))

  dagre.layout(g)

  return nodes.map(n => {
    const pos = g.node(n.id)
    return { ...n, position: { x: pos.x - 100, y: pos.y - 30 } }
  })
}

// ─── Health helpers ───────────────────────────────────────────────────────────
type Health = 'good' | 'warning' | 'critical'

function getHealth(filePath: string, issues: AnalysisIssue[]): Health {
  const fileIssues = issues.filter(i => i.filePath === filePath)
  if (fileIssues.length === 0) return 'good'
  if (fileIssues.some(i => i.impact === 'High')) return 'critical'
  return 'warning'
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
const FileNode = ({ data }: any) => {
  const { label, health, issueCount, selected } = data
  const fileName = label.split('/').pop() ?? label
  const isComponent = /\.(tsx|jsx)$/.test(fileName)
  const isType = /\.ts$/.test(fileName) && !isComponent
  const color = HEALTH_COLOR[health as Health]
  const bg = HEALTH_BG[health as Health]

  return (
    <div style={{
      background: selected ? bg : C.surface,
      border: `1px solid ${selected ? color : health === 'good' ? C.border : color}`,
      borderRadius: 8,
      padding: '8px 12px',
      minWidth: 180,
      maxWidth: 220,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      boxShadow: health !== 'good' ? `0 0 12px ${color}22` : 'none',
      transition: 'all 0.2s ease',
      cursor: 'pointer',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: '#333', border: 'none', width: 6, height: 6 }} />

      {/* Icon */}
      <div style={{ width: 28, height: 28, borderRadius: 6, background: '#161616', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {isComponent
          ? <FileCode size={14} color={color} />
          : isType
          ? <Package size={14} color={C.blue} />
          : <FileText size={14} color={C.muted} />
        }
      </div>

      {/* Label */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {fileName}
        </div>
        <div style={{ fontSize: 9, color: C.muted, fontFamily: 'Geist Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </div>
      </div>

      {/* Health badge */}
      {health !== 'good' && (
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
          {health === 'critical'
            ? <AlertTriangle size={12} color={C.red} />
            : <AlertCircle size={12} color={C.yellow} />
          }
          <span style={{ fontSize: 9, color, fontWeight: 600 }}>{issueCount}</span>
        </div>
      )}
      {health === 'good' && (
        <CheckCircle size={12} color={C.green} style={{ flexShrink: 0, opacity: 0.5 }} />
      )}

      <Handle type="source" position={Position.Bottom} style={{ background: '#333', border: 'none', width: 6, height: 6 }} />
    </div>
  )
}

const nodeTypes = { file: FileNode }

// ─── Main ─────────────────────────────────────────────────────────────────────
interface CodeMapProps {
  projectPath?: string
  issues: AnalysisIssue[]
}

export const CodeMap: React.FC<CodeMapProps> = ({ projectPath, issues }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  useEffect(() => {
    if (!projectPath) return
    setLoading(true)
    setError(null)

    window.electron.invoke(IPC_CHANNELS.GET_PROJECT_DEPENDENCIES, projectPath)
      .then((deps: any[]) => {
        if (!deps || deps.length === 0) {
          setError('Nenhuma dependência encontrada neste projecto.')
          setLoading(false)
          return
        }

        // Build unique file list from deps
        const fileSet = new Set<string>()
        deps.forEach(d => {
          fileSet.add(d.source)
          fileSet.add(d.target)
        })

        const rawNodes: Node[] = Array.from(fileSet).map(filePath => {
          const health = getHealth(
            projectPath + '/' + filePath,
            issues
          )
          const issueCount = issues.filter(i =>
            i.filePath.endsWith(filePath) || i.file === filePath.split('/').pop()
          ).length

          return {
            id: filePath,
            type: 'file',
            position: { x: 0, y: 0 },
            data: { label: filePath, health, issueCount },
          }
        })

        const rawEdges: Edge[] = deps.map((d, i) => ({
          id: `e-${i}`,
          source: d.source,
          target: d.target,
          type: 'smoothstep',
          animated: false,
          style: {
            stroke: '#222',
            strokeWidth: 1.5,
          },
          markerEnd: { type: 'arrowclosed' as any, color: '#333' },
        }))

        const laid = applyDagreLayout(rawNodes, rawEdges)
        setNodes(laid)
        setEdges(rawEdges)
      })
      .catch(err => {
        console.error('CodeMap failed:', err)
        setError('Erro ao carregar o mapa de dependências.')
      })
      .finally(() => setLoading(false))
  }, [projectPath, issues])

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedFile(node.id)
    setNodes(ns => ns.map(n => ({
      ...n,
      data: { ...n.data, selected: n.id === node.id },
    })))
  }, [])

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, flexDirection: 'column', gap: 12 }}>
      <div style={{ width: 20, height: 20, border: `2px solid ${C.border}`, borderTop: `2px solid ${C.blue}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <span style={{ fontSize: 12, color: C.muted }}>A mapear dependências...</span>
    </div>
  )

  if (error) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
      <span style={{ fontSize: 12, color: C.muted }}>{error}</span>
    </div>
  )

  return (
    <div style={{ flex: 1, height: '100%', background: C.bg, position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#161616" gap={24} variant={BackgroundVariant.Dots} />
        <Controls
          showInteractive={false}
          style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6 }}
        />
        <MiniMap
          style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6 }}
          maskColor="rgba(0,0,0,0.6)"
          nodeColor={(n) => HEALTH_COLOR[(n.data?.health as Health) ?? 'good']}
        />
      </ReactFlow>

      {/* Legend */}
      <div style={{ position: 'absolute', bottom: 16, left: 16, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 12px', display: 'flex', gap: 16, zIndex: 10 }}>
        {[
          { color: C.green,  label: 'Sem issues' },
          { color: C.yellow, label: 'Issues médios' },
          { color: C.red,    label: 'Issues críticos' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
            <span style={{ fontSize: 10, color: C.muted }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Selected file info */}
      {selectedFile && (
        <div style={{ position: 'absolute', top: 16, right: 16, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 14px', maxWidth: 260, zIndex: 10 }}>
          <p style={{ fontSize: 10, color: C.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Ficheiro seleccionado</p>
          <p style={{ fontSize: 11, color: C.text, fontFamily: 'Geist Mono, monospace', marginBottom: 8, wordBreak: 'break-all' }}>{selectedFile}</p>
          {(() => {
            const fileIssues = issues.filter(i => i.file === selectedFile.split('/').pop())
            if (fileIssues.length === 0) return <p style={{ fontSize: 11, color: C.green }}>✓ Sem issues detectados</p>
            return (
              <div>
                {fileIssues.map(i => (
                  <div key={i.id} style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: i.impact === 'High' ? C.red : C.yellow, flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: '#888' }}>{i.problem}</span>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
