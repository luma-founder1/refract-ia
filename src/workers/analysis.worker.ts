// src/workers/analysis.worker.ts
import { parse } from '@typescript-eslint/parser'
import { AST_NODE_TYPES } from '@typescript-eslint/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Issue {
  id: string
  file: string
  filePath: string
  category:
    | 'oversized-component'
    | 'any-type'
    | 'dead-state'
    | 'missing-docs'
    | 'console-log'
    | 'effect-no-deps'
    | 'prop-drilling'
    | 'generic-naming'
    | 'circular-dep'
  problem: string
  impact: 'High' | 'Medium' | 'Low'
  lineStart: number
  lineEnd: number
  lines: { before: string[]; after: string[] }
  patch?: { before: string; after: string }
  effort?: 'low' | 'medium' | 'high'
  blastRadius?: number
  priority?: number
}

export interface AnalysisResult {
  projectPath: string
  scannedFiles: string[]
  issues: Issue[]
  truncated?: boolean
  summary: { total: number; high: number; medium: number; low: number }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const IGNORE = new Set([
  'node_modules', '.git', 'dist', 'build', '.build', '.next',
  'out', 'coverage', '.turbo', '.vercel', 'temp', 'tmp', '.asar',
])

const EFFORT: Record<string, 'low' | 'medium' | 'high'> = {
  'any-type':            'low',
  'console-log':         'low',
  'missing-docs':        'low',
  'generic-naming':      'low',
  'dead-state':          'medium',
  'effect-no-deps':      'medium',
  'prop-drilling':       'medium',
  'oversized-component': 'high',
  'circular-dep':        'high',
}

const IMPACT_SCORE: Record<string, number> = { High: 3, Medium: 2, Low: 1 }
const EFFORT_SCORE: Record<string, number> = { low: 1, medium: 2, high: 3 }

const DEFAULT_MAX_FILES = 2000
const DEFAULT_MAX_DEPTH = 15

const GENERIC_NAMES = new Set([
  'data', 'item', 'items', 'list', 'temp', 'tmp', 'foo', 'bar', 'baz',
  'obj', 'object', 'val', 'value', 'res', 'result', 'response',
  'handleClick', 'handleChange', 'handleSubmit', 'onClick', 'onChange',
  'Component', 'Page', 'Container', 'Wrapper', 'Inner', 'Outer',
])

// ─── File utils ───────────────────────────────────────────────────────────────

function getLines(source: string): string[] {
  return source.split('\n')
}

function parseAst(source: string, filePath: string) {
  try {
    return parse(source, { jsx: true, loc: true, range: true, tolerant: true, filePath })
  } catch {
    return null
  }
}

// ─── AST walker ───────────────────────────────────────────────────────────────

function walk(node: any, visitor: (node: any) => void) {
  if (!node || typeof node !== 'object') return
  visitor(node)
  for (const key of Object.keys(node)) {
    const child = node[key]
    if (Array.isArray(child)) child.forEach((c: any) => walk(c, visitor))
    else if (child && typeof child === 'object' && child.type) walk(child, visitor)
  }
}

function makePatch(before: string[], after: string[]): { before: string; after: string } {
  return { before: before.join('\n'), after: after.join('\n') }
}

// ─── Detector: Any Types ──────────────────────────────────────────────────────

function detectAnyTypes(filePath: string, source: string, lines: string[]): Issue[] {
  const ast = parseAst(source, filePath)
  if (!ast) return []
  const issues: Issue[] = []

  walk(ast, (node) => {
    if (node.type === AST_NODE_TYPES.TSAnyKeyword && node.loc) {
      const line = node.loc.start.line
      const context = lines[line - 1] ?? ''
      const fixed = context
        .replace(/:\s*any\b/g, ': unknown')
        .replace(/as\s+any\b/g, 'as unknown')
        .replace(/<any>/g, '<unknown>')
        .replace(/Array<any>/g, 'Array<unknown>')
        .replace(/any\[\]/g, 'unknown[]')

      issues.push({
        id: `any-${filePath}-${line}-${node.loc.start.column}`,
        file: filePath.split('/').pop() || filePath,
        filePath,
        category: 'any-type',
        problem: `Uso de \`any\` — substitui por um tipo concreto`,
        impact: 'Medium',
        lineStart: line,
        lineEnd: line,
        lines: { before: [context], after: [fixed] },
        patch: makePatch([context], [fixed]),
      })
    }
  })

  return issues
}

// ─── Detector: Dead useState ──────────────────────────────────────────────────

function detectDeadState(filePath: string, source: string, lines: string[]): Issue | null {
  const ast = parseAst(source, filePath)
  if (!ast) return null

  const stateDecls: Array<{ varName: string; setterName: string; line: number }> = []

  walk(ast, (node) => {
    if (
      node.type === AST_NODE_TYPES.VariableDeclarator &&
      node.id?.type === AST_NODE_TYPES.ArrayPattern &&
      node.init?.type === AST_NODE_TYPES.CallExpression &&
      node.init?.callee?.name === 'useState' &&
      node.loc
    ) {
      const elements = node.id.elements
      if (elements.length >= 1 && elements[0]?.name) {
        stateDecls.push({
          varName: elements[0].name,
          setterName: elements[1]?.name ?? '',
          line: node.loc.start.line,
        })
      }
    }
  })

  if (stateDecls.length === 0) return null

  const dead = stateDecls.filter(({ varName, line }) => {
    const sourceWithoutDecl = lines.filter((_, i) => i !== line - 1).join('\n')
    return !new RegExp(`\\b${varName}\\b`).test(sourceWithoutDecl)
  })

  if (dead.length === 0) return null

  const deadLines = dead.map(d => lines[d.line - 1] ?? '')

  return {
    id: `dead-state-${filePath}`,
    file: filePath.split('/').pop() || filePath,
    filePath,
    category: 'dead-state',
    problem: `${dead.length} estado${dead.length !== 1 ? 's' : ''} não usado${dead.length !== 1 ? 's' : ''}: ${dead.map(d => d.varName).join(', ')}`,
    impact: 'Medium',
    lineStart: dead[0].line,
    lineEnd: dead[dead.length - 1].line,
    lines: { before: deadLines, after: [] },
    patch: makePatch(deadLines, []),
  }
}

// ─── Detector: Missing JSDoc ──────────────────────────────────────────────────

function detectMissingDocs(filePath: string, source: string, lines: string[]): Issue[] {
  const ast = parseAst(source, filePath)
  if (!ast) return []
  const issues: Issue[] = []
  const comments = ast.comments ?? []

  const hasJsDocAbove = (targetLine: number): boolean =>
    comments.some((c: any) =>
      c.type === 'Block' && c.value.startsWith('*') &&
      c.loc && c.loc.end.line === targetLine - 1
    )

  walk(ast, (node) => {
    if (!node.loc) return
    const line = node.loc.start.line
    const isExported =
      node.type === AST_NODE_TYPES.ExportNamedDeclaration ||
      node.type === AST_NODE_TYPES.ExportDefaultDeclaration
    if (!isExported) return

    const decl = node.declaration
    if (!decl) return

    let name = ''
    if (decl.type === AST_NODE_TYPES.FunctionDeclaration && decl.id) name = decl.id.name
    else if (decl.type === AST_NODE_TYPES.ClassDeclaration && decl.id) name = decl.id.name
    else if (decl.type === AST_NODE_TYPES.VariableDeclaration) {
      const v = decl.declarations[0]
      if (v?.id?.name) name = v.id.name
    }

    if (!name || hasJsDocAbove(line)) return

    const code = lines[line - 1] ?? ''
    const afterLines = [`/**`, ` * ${name} — adiciona descrição aqui`, ` */`, code]

    issues.push({
      id: `docs-${filePath}-${line}`,
      file: filePath.split('/').pop() || filePath,
      filePath,
      category: 'missing-docs',
      problem: `Export \`${name}\` sem JSDoc`,
      impact: 'Low',
      lineStart: line,
      lineEnd: line,
      lines: { before: [code], after: afterLines },
      patch: makePatch([code], afterLines),
    })
  })

  return issues
}

// ─── Detector: Oversized Component ───────────────────────────────────────────

function detectOversized(filePath: string, source: string, lines: string[]): Issue | null {
  if (!/\.(tsx|jsx)$/.test(filePath)) return null
  const ast = parseAst(source, filePath)
  if (!ast) return null

  const large: Array<{ name: string; lineStart: number; lineEnd: number; size: number }> = []

  walk(ast, (node) => {
    const isFn =
      node.type === AST_NODE_TYPES.FunctionDeclaration ||
      node.type === AST_NODE_TYPES.ArrowFunctionExpression ||
      node.type === AST_NODE_TYPES.FunctionExpression
    if (!isFn || !node.loc) return

    const size = node.loc.end.line - node.loc.start.line
    if (size < 80) return

    let hasJsx = false
    walk(node, (child) => {
      if (child.type === AST_NODE_TYPES.JSXElement || child.type === AST_NODE_TYPES.JSXFragment)
        hasJsx = true
    })
    if (!hasJsx) return

    let name = 'Component'
    if (node.id?.name) name = node.id.name
    else if (node.parent?.id?.name) name = node.parent.id.name

    large.push({ name, lineStart: node.loc.start.line, lineEnd: node.loc.end.line, size })
  })

  if (large.length === 0) {
    if (lines.length < 200) return null
    const preview = lines.slice(0, 12)
    return {
      id: `oversized-${filePath}`,
      file: filePath.split('/').pop() || filePath,
      filePath,
      category: 'oversized-component',
      problem: `Ficheiro com ${lines.length} linhas — considera dividir em módulos`,
      impact: lines.length > 300 ? 'High' : 'Medium',
      lineStart: 1,
      lineEnd: lines.length,
      lines: { before: preview, after: [] },
      patch: { before: '', after: '' },
    }
  }

  const worst = large.sort((a, b) => b.size - a.size)[0]
  const contextLines = lines.slice(worst.lineStart - 1, worst.lineStart + 10)

  return {
    id: `oversized-${filePath}`,
    file: filePath.split('/').pop() || filePath,
    filePath,
    category: 'oversized-component',
    problem: `${worst.name} tem ${worst.size} linhas — divide em sub-componentes`,
    impact: worst.size > 200 ? 'High' : 'Medium',
    lineStart: worst.lineStart,
    lineEnd: worst.lineEnd,
    lines: { before: contextLines, after: [] },
    patch: { before: '', after: '' },
  }
}

// ─── Detector: Console.log esquecido ─────────────────────────────────────────

function detectConsoleLogs(filePath: string, source: string, lines: string[]): Issue[] {
  const ast = parseAst(source, filePath)
  if (!ast) return []
  const issues: Issue[] = []

  walk(ast, (node) => {
    if (
      node.type === AST_NODE_TYPES.CallExpression &&
      node.callee?.type === AST_NODE_TYPES.MemberExpression &&
      node.callee.object?.name === 'console' &&
      ['log', 'warn', 'debug', 'info'].includes(node.callee.property?.name) &&
      node.loc
    ) {
      const line = node.loc.start.line
      const context = lines[line - 1] ?? ''

      issues.push({
        id: `console-${filePath}-${line}`,
        file: filePath.split('/').pop() || filePath,
        filePath,
        category: 'console-log',
        problem: `\`console.${node.callee.property.name}\` esquecido — remove antes de produção`,
        impact: 'Low',
        lineStart: line,
        lineEnd: line,
        lines: { before: [context], after: [] },
        patch: makePatch([context], []),
      })
    }
  })

  return issues
}

// ─── Detector: useEffect sem dependency array ─────────────────────────────────

function detectEffectNoDeps(filePath: string, source: string, lines: string[]): Issue[] {
  if (!/\.(tsx?|jsx?)$/.test(filePath)) return []
  const ast = parseAst(source, filePath)
  if (!ast) return []
  const issues: Issue[] = []

  walk(ast, (node) => {
    if (
      node.type === AST_NODE_TYPES.CallExpression &&
      node.callee?.name === 'useEffect' &&
      node.arguments?.length === 1 &&
      node.loc
    ) {
      const line = node.loc.start.line
      const endLine = node.loc.end.line
      const context = lines[line - 1] ?? ''

      issues.push({
        id: `effect-no-deps-${filePath}-${line}`,
        file: filePath.split('/').pop() || filePath,
        filePath,
        category: 'effect-no-deps',
        problem: `useEffect sem dependency array — corre em cada render e causa loops`,
        impact: 'High',
        lineStart: line,
        lineEnd: endLine,
        lines: { before: [context], after: [] },
        patch: { before: '', after: '' },
      })
    }
  })

  return issues
}

// ─── Detector: Nomenclatura genérica ─────────────────────────────────────────

function detectGenericNaming(filePath: string, source: string, lines: string[]): Issue[] {
  const ast = parseAst(source, filePath)
  if (!ast) return []
  const issues: Issue[] = []
  const seen = new Set<string>()

  walk(ast, (node) => {
    // Variáveis com nomes genéricos
    if (
      node.type === AST_NODE_TYPES.VariableDeclarator &&
      node.id?.type === AST_NODE_TYPES.Identifier &&
      node.loc
    ) {
      const name: string = node.id.name
      if (!GENERIC_NAMES.has(name)) return
      const key = `${name}-${node.loc.start.line}`
      if (seen.has(key)) return
      seen.add(key)

      const line = node.loc.start.line
      const context = lines[line - 1] ?? ''

      issues.push({
        id: `naming-${filePath}-${line}-${name}`,
        file: filePath.split('/').pop() || filePath,
        filePath,
        category: 'generic-naming',
        problem: `Nome genérico \`${name}\` — usa um nome que descreva o propósito`,
        impact: 'Low',
        lineStart: line,
        lineEnd: line,
        lines: { before: [context], after: [] },
        patch: { before: '', after: '' },
      })
    }

    // Props desestruturadas com nomes genéricos
    if (
      (node.type === AST_NODE_TYPES.FunctionDeclaration ||
       node.type === AST_NODE_TYPES.ArrowFunctionExpression) &&
      node.params?.length > 0 &&
      node.loc
    ) {
      for (const param of node.params) {
        if (param.type !== AST_NODE_TYPES.ObjectPattern) continue
        for (const prop of param.properties ?? []) {
          if (
            prop.type === AST_NODE_TYPES.Property &&
            prop.key?.type === AST_NODE_TYPES.Identifier
          ) {
            const propName: string = prop.key.name
            if (!GENERIC_NAMES.has(propName)) continue
            const line = prop.loc?.start.line ?? node.loc!.start.line
            const key = `prop-${propName}-${line}`
            if (seen.has(key)) continue
            seen.add(key)

            const context = lines[line - 1] ?? ''
            issues.push({
              id: `naming-prop-${filePath}-${line}-${propName}`,
              file: filePath.split('/').pop() || filePath,
              filePath,
              category: 'generic-naming',
              problem: `Prop genérica \`${propName}\` — renomeia para descrever o dado`,
              impact: 'Low',
              lineStart: line,
              lineEnd: line,
              lines: { before: [context], after: [] },
              patch: { before: '', after: '' },
            })
          }
        }
      }
    }
  })

  return issues
}

// ─── Detector: Prop drilling ────────────────────────────────────────────────

function detectPropDrilling(filePath: string, source: string, lines: string[]): Issue[] {
  const ast = parseAst(source, filePath)
  if (!ast) return []

  const issues: Issue[] = []
  const reported = new Set<string>()

  const inspect = (componentName: string, fnNode: any) => {
    if (!fnNode?.loc || !/^[A-Z]/.test(componentName)) return

    let hasJsx = false
    walk(fnNode, (child) => {
      if (child.type === AST_NODE_TYPES.JSXElement || child.type === AST_NODE_TYPES.JSXFragment) {
        hasJsx = true
      }
    })
    if (!hasJsx) return

    const param = fnNode.params?.[0]
    if (!param) return

    let propCount = 0
    let forwardsProps = false

    if (param.type === AST_NODE_TYPES.Identifier) {
      const propSource = param.name
      const uniqueProps = new Set<string>()

      walk(fnNode, (child) => {
        if (
          child.type === AST_NODE_TYPES.MemberExpression &&
          child.object?.type === AST_NODE_TYPES.Identifier &&
          child.object.name === propSource &&
          child.property?.type === AST_NODE_TYPES.Identifier
        ) {
          uniqueProps.add(child.property.name)
        }

        if (
          child.type === AST_NODE_TYPES.JSXSpreadAttribute &&
          child.argument?.type === AST_NODE_TYPES.Identifier &&
          child.argument.name === propSource
        ) {
          forwardsProps = true
        }
      })

      propCount = uniqueProps.size
    } else if (param.type === AST_NODE_TYPES.ObjectPattern) {
      const uniqueProps = new Set<string>()

      for (const property of param.properties) {
        if (property.type !== AST_NODE_TYPES.Property) continue
        if (property.key.type === AST_NODE_TYPES.Identifier) {
          uniqueProps.add(property.key.name)
        }
      }

      propCount = uniqueProps.size
      forwardsProps = propCount >= 4
    }

    if (propCount < 4 && !forwardsProps) return

    const key = `${filePath}-${fnNode.loc.start.line}-${componentName}`
    if (reported.has(key)) return
    reported.add(key)

    const context = lines.slice(
      Math.max(0, fnNode.loc.start.line - 1),
      Math.min(lines.length, fnNode.loc.start.line + 4)
    )

    issues.push({
      id: `prop-drilling-${filePath}-${fnNode.loc.start.line}`,
      file: filePath.split('/').pop() || filePath,
      filePath,
      category: 'prop-drilling',
      problem: forwardsProps
        ? `Provável prop drilling em \`${componentName}\` — recebe ${propCount} prop(s) e encaminha props para filhos`
        : `\`${componentName}\` recebe ${propCount} prop(s) — considera reduzir a superfície de props`,
      impact: propCount >= 6 ? 'Medium' : 'Low',
      lineStart: fnNode.loc.start.line,
      lineEnd: fnNode.loc.end.line,
      lines: { before: context, after: [] },
      patch: makePatch(context, []),
    })
  }

  walk(ast, (node) => {
    if (node.type === AST_NODE_TYPES.FunctionDeclaration && node.id?.name) {
      inspect(node.id.name, node)
      return
    }

    if (
      node.type === AST_NODE_TYPES.VariableDeclarator &&
      node.id?.type === AST_NODE_TYPES.Identifier &&
      node.init &&
      (node.init.type === AST_NODE_TYPES.ArrowFunctionExpression || node.init.type === AST_NODE_TYPES.FunctionExpression)
    ) {
      inspect(node.id.name, node.init)
    }
  })

  return issues
}

// ─── Detector: Dependências circulares ───────────────────────────────────────

function extractLocalImports(source: string, fromFile: string, projectPath: string): string[] {
  const results: string[] = []
  const importRegex = /(?:import|export)\s+(?:[\s\S]*?from\s+)?['"](\.\.?\/[^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = importRegex.exec(source)) !== null) {
    results.push(m[1])
  }
  return results
}

function detectCircularDeps(
  allFiles: string[],
  importMap: Map<string, string[]>,
  projectPath: string
): Issue[] {
  const issues: Issue[] = []
  const reported = new Set<string>()

  function findCycle(start: string, current: string, visited: Set<string>): string[] | null {
    if (current === start && visited.size > 0) return [current]
    if (visited.has(current)) return null
    visited.add(current)
    for (const dep of importMap.get(current) ?? []) {
      const cycle = findCycle(start, dep, new Set(visited))
      if (cycle) return [current, ...cycle]
    }
    return null
  }

  for (const file of allFiles) {
    const cycle = findCycle(file, file, new Set())
    if (!cycle) continue

    const key = [...cycle].sort().join('|')
    if (reported.has(key)) continue
    reported.add(key)

    issues.push({
      id: `circular-${key.slice(0, 60)}`,
      file: file.split('/').pop() || file,
      filePath: file,
      category: 'circular-dep',
      problem: `Dependência circular: ${cycle.map(f => f.split('/').pop() || f).join(' → ')}`,
      impact: 'High',
      lineStart: 1,
      lineEnd: 1,
      lines: { before: ['// Dependência circular — quebra esta ligação'], after: [] },
      patch: { before: '', after: '' },
    })
  }

  return issues
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function runAnalysis(
  files: Map<string, string>, // filePath -> content
  onProgress?: (file: string) => void,
  opts: { maxFiles?: number; maxDepth?: number } = {}
): Promise<AnalysisResult> {
  const maxFiles = opts.maxFiles ?? DEFAULT_MAX_FILES
  const projectPath = ''
  const fileArray = Array.from(files.keys())
  const truncated = fileArray.length >= maxFiles
  const issues: Issue[] = []

  const importMap = new Map<string, string[]>()
  const relFiles: string[] = fileArray

  for (const filePath of fileArray.slice(0, maxFiles)) {
    onProgress?.(filePath)
    const source = files.get(filePath) || ''
    if (!source.trim()) continue

    importMap.set(filePath, extractLocalImports(source, filePath, projectPath))

    const lines = getLines(source)

    const issueSets = [
      detectAnyTypes(filePath, source, lines),
      detectDeadState(filePath, source, lines),
      detectMissingDocs(filePath, source, lines),
      detectOversized(filePath, source, lines),
      detectConsoleLogs(filePath, source, lines),
      detectEffectNoDeps(filePath, source, lines),
      detectPropDrilling(filePath, source, lines),
      detectGenericNaming(filePath, source, lines),
    ]

    for (const set of issueSets) {
      if (Array.isArray(set)) issues.push(...set)
      else if (set) issues.push(set)
    }
  }

  // Circular deps: analisa o grafo completo no fim
  issues.push(...detectCircularDeps(relFiles, importMap, projectPath))

  // Construir reverse map: ficheiro → quantos ficheiros o importam
  const reverseMap = new Map<string, number>()
  for (const [, deps] of importMap.entries()) {
    for (const dep of deps) {
      reverseMap.set(dep, (reverseMap.get(dep) ?? 0) + 1)
    }
  }

  // Enriquecer issues com effort, blastRadius, priority
  const enrichedIssues = issues.map(issue => {
    const effort = EFFORT[issue.category] ?? 'medium'
    const blastRadius = reverseMap.get(issue.filePath) ?? 0
    const impactScore = IMPACT_SCORE[issue.impact]
    const effortScore = EFFORT_SCORE[effort]
    const priority = (impactScore * 10 + blastRadius) / effortScore
    return { ...issue, effort, blastRadius, priority }
  })

  return {
    projectPath,
    scannedFiles: fileArray.slice(0, maxFiles),
    issues: enrichedIssues,
    truncated,
    summary: {
      total: enrichedIssues.length,
      high:   enrichedIssues.filter(i => i.impact === 'High').length,
      medium: enrichedIssues.filter(i => i.impact === 'Medium').length,
      low:    enrichedIssues.filter(i => i.impact === 'Low').length,
    },
  }
}

// Worker message handler
self.onmessage = async (e: MessageEvent) => {
  const { files: filesObj, opts } = e.data

  // Deserialize plain object back to Map
  const filesMap = new Map<string, string>(Object.entries(filesObj))

  try {
    const result = await runAnalysis(filesMap, (file: string) => {
      self.postMessage({ type: 'progress', file })
    }, opts)
    self.postMessage({ type: 'success', result })
  } catch (error) {
    self.postMessage({ type: 'error', error: String(error) })
  }
}
