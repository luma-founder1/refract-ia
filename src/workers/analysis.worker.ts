// src/workers/analysis.worker.ts
//
// ⚠️  MIGRAÇÃO: ts-morph → @typescript-eslint/typescript-estree
//
// ts-morph usa APIs de Node.js (fs, path) e não funciona num Web Worker no browser.
// @typescript-eslint/typescript-estree é um parser TypeScript puro que funciona
// em qualquer ambiente JS, incluindo Web Workers.
//
// INSTALL (se ainda não tens):
//   npm install @typescript-eslint/typescript-estree
//   npm install --save-dev @types/node   (só para tipos, não é usado em runtime)

import {
  parse,
  simpleTraverse,
  TSESTree,
} from '@typescript-eslint/typescript-estree'

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

const GENERIC_NAMES = new Set([
  'data', 'item', 'items', 'list', 'temp', 'tmp', 'foo', 'bar', 'baz',
  'obj', 'object', 'val', 'value', 'res', 'result', 'response',
  'handleClick', 'handleChange', 'handleSubmit', 'onClick', 'onChange',
  'Component', 'Page', 'Container', 'Wrapper', 'Inner', 'Outer',
])

const EFFORT_MAP: Record<string, 'low' | 'medium' | 'high'> = {
  'any-type': 'low', 'console-log': 'low', 'missing-docs': 'low',
  'generic-naming': 'low', 'dead-state': 'medium', 'effect-no-deps': 'medium',
  'prop-drilling': 'medium', 'oversized-component': 'high', 'circular-dep': 'high',
}

// ─── Parse helper ─────────────────────────────────────────────────────────────

interface ParsedFile {
  ast: TSESTree.Program
  lines: string[]
  filePath: string
  fileName: string
  isTsx: boolean
}

function parseFile(filePath: string, content: string): ParsedFile | null {
  const isTsx = /\.(tsx|jsx)$/.test(filePath)
  const isTs  = /\.(ts|tsx|js|jsx)$/.test(filePath)
  if (!isTs) return null

  try {
    const ast = parse(content, {
      jsx: isTsx,
      tolerant: true,     // não explode em erros de sintaxe — continua a analisar
      loc: true,
      range: false,
      tokens: false,
      comment: false,
    })
    return {
      ast,
      lines: content.split('\n'),
      filePath,
      fileName: filePath.replace(/\\/g, '/').split('/').pop() ?? filePath,
      isTsx,
    }
  } catch {
    // Ficheiro com sintaxe demasiado quebrada — salta
    return null
  }
}

// ─── Traverse helpers ─────────────────────────────────────────────────────────

/** Caminha por todos os nós de um AST e chama o callback para cada tipo. */
function walk(node: any, visitor: Record<string, (n: any) => void>) {
  simpleTraverse(node as any, {
    enter(n: any) {
      const fn = visitor[n.type]
      if (fn) fn(n)
    },
  })
}

/** Devolve todos os nós de um tipo específico dentro de um nó raiz. */
function findAll(root: any, type: string): any[] {
  const results: any[] = []
  simpleTraverse(root as any, {
    enter(n: any) {
      if (n.type === type) results.push(n)
    },
  })
  return results
}

function lineOf(node: TSESTree.Node): number {
  return node.loc?.start.line ?? 1
}
function endLineOf(node: TSESTree.Node): number {
  return node.loc?.end.line ?? 1
}

// ─── Detector: any types ──────────────────────────────────────────────────────

function detectAnyTypes(pf: ParsedFile): Issue[] {
  const issues: Issue[] = []
  const seen = new Set<number>()

  walk(pf.ast, {
    TSAnyKeyword(node) {
      const line = lineOf(node)
      if (seen.has(line)) return
      seen.add(line)

      const lineText = pf.lines[line - 1] ?? ''
      const fixed = lineText
        .replace(/:\s*any\b/g, ': unknown')
        .replace(/as\s+any\b/g, 'as unknown')
        .replace(/<any>/g, '<unknown>')
        .replace(/Array<any>/g, 'Array<unknown>')
        .replace(/any\[\]/g, 'unknown[]')

      issues.push({
        id: `any-${pf.filePath}-${line}`,
        file: pf.fileName,
        filePath: pf.filePath,
        category: 'any-type',
        problem: 'Uso de `any` — substitui por um tipo concreto',
        impact: 'Medium',
        lineStart: line,
        lineEnd: line,
        lines: { before: [lineText], after: [fixed] },
        patch: { before: lineText, after: fixed },
      })
    },
  })

  return issues
}

// ─── Detector: dead useState ──────────────────────────────────────────────────

function detectDeadState(pf: ParsedFile): Issue | null {
  // Encontrar declarações: const [x, setX] = useState(...)
  const stateDecls: Array<{ varName: string; line: number }> = []

  walk(pf.ast, {
    VariableDeclarator(node) {
      if (
        !node.init ||
        node.init.type !== 'CallExpression' ||
        node.init.callee.type !== 'Identifier' ||
        node.init.callee.name !== 'useState'
      ) return

      if (node.id.type !== 'ArrayPattern') return
      const first = node.id.elements[0]
      if (!first || first.type !== 'Identifier') return

      stateDecls.push({ varName: first.name, line: lineOf(node) })
    },
  })

  if (stateDecls.length === 0) return null

  // Contar referências a cada variável no ficheiro inteiro
  const allIdentifiers = findAll(pf.ast, 'Identifier')
  const refCount = new Map<string, number>()
  for (const id of allIdentifiers) {
    refCount.set(id.name, (refCount.get(id.name) ?? 0) + 1)
  }

  // "Morto" = referenciado ≤ 1 vez (a própria declaração conta como 1)
  const dead = stateDecls.filter(d => (refCount.get(d.varName) ?? 0) <= 1)
  if (dead.length === 0) return null

  const deadLines = dead.map(d => pf.lines[d.line - 1] ?? '')

  return {
    id: `dead-state-${pf.filePath}`,
    file: pf.fileName,
    filePath: pf.filePath,
    category: 'dead-state',
    problem: `${dead.length} estado(s) não usado(s): ${dead.map(d => d.varName).join(', ')}`,
    impact: 'Medium',
    lineStart: dead[0].line,
    lineEnd: dead[dead.length - 1].line,
    lines: { before: deadLines, after: [] },
    patch: { before: deadLines.join('\n'), after: '' },
  }
}

// ─── Detector: missing JSDoc ──────────────────────────────────────────────────

function detectMissingDocs(pf: ParsedFile): Issue[] {
  const issues: Issue[] = []

  for (const node of pf.ast.body) {
    let name = ''
    let line = 0

    if (node.type === 'ExportNamedDeclaration' && node.declaration) {
      const decl = node.declaration
      if (decl.type === 'FunctionDeclaration' && decl.id) {
        name = (decl as any).id?.name ?? '';
        line = lineOf(node)
      } else if (decl.type === 'VariableDeclaration') {
        for (const d of decl.declarations) {
          if (d.id.type === 'Identifier') {
            name = (d.id as any).name ?? '';
            line = lineOf(node)
          }
        }
      } else if (
        decl.type === 'TSInterfaceDeclaration' ||
        decl.type === 'TSTypeAliasDeclaration'
      ) {
        name = (decl as any).id?.name ?? 'unknown'; line = lineOf(node)
      }
    } else if (node.type === 'ExportDefaultDeclaration') {
      name = 'default'; line = lineOf(node)
    }

    if (!name || !line) continue

    // Verifica se as 3 linhas acima têm bloco JSDoc
    const prevLines = pf.lines.slice(Math.max(0, line - 4), line - 1)
    const hasJsDoc = prevLines.some(l => l.trim().startsWith('*') || l.trim() === '*/')
    if (hasJsDoc) continue

    const code = pf.lines[line - 1] ?? ''
    issues.push({
      id: `docs-${pf.filePath}-${line}`,
      file: pf.fileName,
      filePath: pf.filePath,
      category: 'missing-docs',
      problem: `Export \`${name}\` sem JSDoc`,
      impact: 'Low',
      lineStart: line,
      lineEnd: line,
      lines: { before: [code], after: ['/**', ` * ${name} — descrição aqui`, ' */', code] },
      patch: { before: code, after: `/**\n * ${name} — descrição aqui\n */\n${code}` },
    })
  }

  return issues
}

// ─── Detector: oversized component ───────────────────────────────────────────

function detectOversized(pf: ParsedFile): Issue | null {
  if (!pf.isTsx) return null

  const totalLines = pf.lines.length
  const candidates: Array<{ name: string; start: number; end: number; size: number }> = []

  function checkFn(
    node: TSESTree.FunctionDeclaration | TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression,
    name: string,
  ) {
    const size = endLineOf(node) - lineOf(node)
    if (size < 80) return
    const hasJsx = findAll(node, 'JSXElement').length > 0 || findAll(node, 'JSXFragment').length > 0
    if (!hasJsx) return
    candidates.push({ name, start: lineOf(node), end: endLineOf(node), size })
  }

  walk(pf.ast, {
    FunctionDeclaration(node) { checkFn(node, (node.id as any)?.name ?? 'Component') },
    ArrowFunctionExpression(node) { checkFn(node, 'Component') },
    FunctionExpression(node) { checkFn(node, 'Component') },
  })

  // Para arrow functions, tentar recuperar o nome da variável
  walk(pf.ast, {
    VariableDeclarator(node) {
      if (node.id.type !== 'Identifier') return
      if (!node.init) return
      if (
        node.init.type === 'ArrowFunctionExpression' ||
        node.init.type === 'FunctionExpression'
      ) {
        const size = endLineOf(node.init) - lineOf(node.init)
        if (size < 80) return
        const hasJsx = findAll(node.init, 'JSXElement').length > 0 || findAll(node.init, 'JSXFragment').length > 0
        if (!hasJsx) return
        // Corrigir o nome no candidato que já foi adicionado (mesmo lineOf)
        const existing = candidates.find(c => c.start === lineOf(node.init))
        if (existing && existing.name === 'Component') existing.name = (node.id as any)?.name
      }
    },
  })

  if (candidates.length === 0) {
    if (totalLines < 200) return null
    const preview = pf.lines.slice(0, 12)
    return {
      id: `oversized-${pf.filePath}`,
      file: pf.fileName,
      filePath: pf.filePath,
      category: 'oversized-component',
      problem: `Ficheiro com ${totalLines} linhas — considera dividir em módulos`,
      impact: totalLines > 300 ? 'High' : 'Medium',
      lineStart: 1,
      lineEnd: totalLines,
      lines: { before: preview, after: [] },
      patch: { before: '', after: '' },
    }
  }

  const worst = candidates.sort((a, b) => b.size - a.size)[0]
  const context = pf.lines.slice(worst.start - 1, Math.min(pf.lines.length, worst.start + 10))

  return {
    id: `oversized-${pf.filePath}`,
    file: pf.fileName,
    filePath: pf.filePath,
    category: 'oversized-component',
    problem: `${worst.name} tem ${worst.size} linhas — divide em sub-componentes`,
    impact: worst.size > 200 ? 'High' : 'Medium',
    lineStart: worst.start,
    lineEnd: worst.end,
    lines: { before: context, after: [] },
    patch: { before: '', after: '' },
  }
}

// ─── Detector: console.log ────────────────────────────────────────────────────

function detectConsoleLogs(pf: ParsedFile): Issue[] {
  const issues: Issue[] = []

  walk(pf.ast, {
    CallExpression(node) {
      if (
        node.callee.type !== 'MemberExpression' ||
        node.callee.object.type !== 'Identifier' ||
        node.callee.object.name !== 'console' ||
        node.callee.property.type !== 'Identifier'
      ) return

      const method = node.callee.property.name
      if (!['log', 'warn', 'debug', 'info'].includes(method)) return

      const line = lineOf(node)
      const lineText = pf.lines[line - 1] ?? ''

      issues.push({
        id: `console-${pf.filePath}-${line}`,
        file: pf.fileName,
        filePath: pf.filePath,
        category: 'console-log',
        problem: `\`console.${method}\` esquecido — remove antes de produção`,
        impact: 'Low',
        lineStart: line,
        lineEnd: line,
        lines: { before: [lineText], after: [] },
        patch: { before: lineText, after: '' },
      })
    },
  })

  return issues
}

// ─── Detector: useEffect sem deps ───────────────────────────────────────────

function detectEffectNoDeps(pf: ParsedFile): Issue[] {
  const issues: Issue[] = []

  walk(pf.ast, {
    CallExpression(node) {
      if (
        node.callee.type !== 'Identifier' ||
        node.callee.name !== 'useEffect'
      ) return

      if (node.arguments.length !== 1) return

      const line = lineOf(node)
      const endLine = endLineOf(node)

      issues.push({
        id: `effect-no-deps-${pf.filePath}-${line}`,
        file: pf.fileName,
        filePath: pf.filePath,
        category: 'effect-no-deps',
        problem: 'useEffect sem dependency array — corre em cada render e causa loops',
        impact: 'High',
        lineStart: line,
        lineEnd: endLine,
        lines: { before: [pf.lines[line - 1] ?? ''], after: [] },
        patch: { before: '', after: '' },
      })
    },
  })

  return issues
}

// ─── Detector: generic naming ─────────────────────────────────────────────────

function detectGenericNaming(pf: ParsedFile): Issue[] {
  const issues: Issue[] = []
  const seen = new Set<string>()

  walk(pf.ast, {
    VariableDeclarator(node) {
      if (node.id.type !== 'Identifier') return
      const name = node.id.name
      if (!GENERIC_NAMES.has(name)) return
      const line = lineOf(node)
      const key = `${name}-${line}`
      if (seen.has(key)) return
      seen.add(key)

      issues.push({
        id: `naming-${pf.filePath}-${line}-${name}`,
        file: pf.fileName,
        filePath: pf.filePath,
        category: 'generic-naming',
        problem: `Nome genérico \`${name}\` — usa um nome que descreva o propósito`,
        impact: 'Low',
        lineStart: line,
        lineEnd: line,
        lines: { before: [pf.lines[line - 1] ?? ''], after: [] },
      })
    },
  })

  walk(pf.ast, {
    ObjectPattern(node) {
      for (const prop of node.properties) {
        if (prop.type !== 'Property') continue
        const val = prop.value
        if (val.type !== 'Identifier') continue
        const name = val.name
        if (!GENERIC_NAMES.has(name)) continue
        const line = lineOf(prop)
        const key = `prop-${name}-${line}`
        if (seen.has(key)) return
        seen.add(key)

        issues.push({
          id: `naming-prop-${pf.filePath}-${line}-${name}`,
          file: pf.fileName,
          filePath: pf.filePath,
          category: 'generic-naming',
          problem: `Prop genérica \`${name}\` — renomeia para descrever o dado`,
          impact: 'Low',
          lineStart: line,
          lineEnd: line,
          lines: { before: [pf.lines[line - 1] ?? ''], after: [] },
        })
      }
    },
  })

  return issues
}

// ─── Detector: prop drilling ──────────────────────────────────────────────────

function detectPropDrilling(pf: ParsedFile): Issue[] {
  const issues: Issue[] = []
  const reported = new Set<string>()

  function checkFn(
    fnNode: TSESTree.FunctionDeclaration | TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression,
    name: string,
  ) {
    if (!/^[A-Z]/.test(name)) return
    const hasJsx = findAll(fnNode, 'JSXElement').length > 0 || findAll(fnNode, 'JSXFragment').length > 0
    if (!hasJsx) return

    const param = fnNode.params[0]
    if (!param) return

    let propCount = 0
    let forwardsProps = false

    if (param.type === 'Identifier') {
      const propName = param.name
      const accesses = new Set<string>()
      findAll(fnNode, 'MemberExpression').forEach(me => {
        if (
          me.object.type === 'Identifier' &&
          me.object.name === propName &&
          me.property.type === 'Identifier'
        ) accesses.add(me.property.name)
      })
      propCount = accesses.size
      findAll(fnNode, 'JSXSpreadAttribute').forEach(sa => {
        if (sa.argument.type === 'Identifier' && sa.argument.name === propName) forwardsProps = true
      })
    } else if (param.type === 'ObjectPattern') {
      const names = new Set<string>()
      for (const p of param.properties) {
        if (p.type === 'RestElement') { forwardsProps = true; continue }
        if (p.type === 'Property' && p.value.type === 'Identifier') names.add(p.value.name)
      }
      propCount = names.size
      if (propCount >= 4) forwardsProps = true
    }

    if (propCount < 4 && !forwardsProps) return

    const key = `${pf.filePath}-${lineOf(fnNode)}-${name}`
    if (reported.has(key)) return
    reported.add(key)

    const context = pf.lines.slice(
      Math.max(0, lineOf(fnNode) - 1),
      Math.min(pf.lines.length, lineOf(fnNode) + 4),
    )

    issues.push({
      id: `prop-drilling-${pf.filePath}-${lineOf(fnNode)}`,
      file: pf.fileName,
      filePath: pf.filePath,
      category: 'prop-drilling',
      problem: forwardsProps
        ? `Provável prop drilling em \`${name}\` — recebe ${propCount} prop(s) e encaminha para filhos`
        : `\`${name}\` recebe ${propCount} prop(s) — considera reduzir a superfície de props`,
      impact: propCount >= 6 ? 'Medium' : 'Low',
      lineStart: lineOf(fnNode),
      lineEnd: endLineOf(fnNode),
      lines: { before: context, after: [] },
      patch: { before: context.join('\n'), after: '' },
    })
  }

  walk(pf.ast, {
    FunctionDeclaration(node) {
      if (node.id) checkFn(node, node.id.name)
    },
  })

  walk(pf.ast, {
    VariableDeclarator(node) {
      if (node.id.type !== 'Identifier') return
      const name = node.id.name
      if (!node.init) return
      if (
        node.init.type === 'ArrowFunctionExpression' ||
        node.init.type === 'FunctionExpression'
      ) checkFn(node.init, name)
    },
  })

  return issues
}

// ─── Detector: circular deps ──────────────────────────────────────────────────

function buildImportMap(files: Map<string, string>): Map<string, string[]> {
  const importMap = new Map<string, string[]>()

  for (const [filePath, content] of files) {
    if (!/\.(ts|tsx|js|jsx)$/.test(filePath)) continue
    const parsed = parseFile(filePath, content)
    if (!parsed) continue

    const deps: string[] = []

    for (const node of parsed.ast.body) {
      if (
        node.type !== 'ImportDeclaration' &&
        node.type !== 'ExportNamedDeclaration' &&
        node.type !== 'ExportAllDeclaration'
      ) continue

      const source = (node as any).source?.value
      if (typeof source !== 'string' || !source.startsWith('.')) continue

      const dir = filePath.replace(/\\/g, '/').split('/').slice(0, -1).join('/')
      const resolved = resolveRelative(dir, source, files)
      if (resolved) deps.push(resolved)
    }

    importMap.set(filePath, deps)
  }

  return importMap
}

function resolveRelative(dir: string, spec: string, files: Map<string, string>): string | null {
  const joined = dir ? `${dir}/${spec}` : spec
  const normalized = normalizePath(joined)
  const exts = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js']
  for (const ext of exts) {
    if (files.has(normalized + ext)) return normalized + ext
  }
  return null
}

function normalizePath(p: string): string {
  const parts = p.replace(/\\/g, '/').split('/')
  const out: string[] = []
  for (const part of parts) {
    if (part === '..') out.pop()
    else if (part !== '.') out.push(part)
  }
  return out.join('/')
}

function detectCircularDeps(files: Map<string, string>): Issue[] {
  const importMap = buildImportMap(files)
  const issues: Issue[] = []
  const reported = new Set<string>()

  function findCycle(start: string, current: string, visited: Set<string>): string[] | null {
    if (current === start && visited.size > 0) return [current]
    if (visited.has(current)) return null
    const next = new Set(visited)
    next.add(current)
    for (const dep of importMap.get(current) ?? []) {
      const cycle = findCycle(start, dep, next)
      if (cycle) return [current, ...cycle]
    }
    return null
  }

  for (const file of importMap.keys()) {
    const cycle = findCycle(file, file, new Set())
    if (!cycle) continue
    const key = [...cycle].sort().join('|')
    if (reported.has(key)) continue
    reported.add(key)

    const shortNames = cycle.map(f => f.replace(/\\/g, '/').split('/').pop() ?? f)
    issues.push({
      id: `circular-${key.slice(0, 60)}`,
      file: file.replace(/\\/g, '/').split('/').pop() ?? file,
      filePath: file,
      category: 'circular-dep',
      problem: `Dependência circular: ${shortNames.join(' → ')}`,
      impact: 'High',
      lineStart: 1,
      lineEnd: 1,
      lines: { before: ['// Dependência circular'], after: [] },
      patch: { before: '', after: '' },
    })
  }

  return issues
}

// ─── Enrich ───────────────────────────────────────────────────────────────────

function enrichIssues(issues: Issue[], reverseMap: Map<string, number>): Issue[] {
  return issues.map(issue => {
    const effort = EFFORT_MAP[issue.category] ?? 'medium'
    const blastRadius = reverseMap.get(issue.filePath) ?? 0
    const impactScore = { High: 3, Medium: 2, Low: 1 }[issue.impact]
    const effortScore = { low: 1, medium: 2, high: 3 }[effort]
    const priority = (impactScore * 10 + blastRadius) / effortScore
    return { ...issue, effort, blastRadius, priority }
  })
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function runAnalysis(
  files: Map<string, string>,
  onProgress?: (file: string) => void,
): Promise<AnalysisResult> {
  const issues: Issue[] = []
  const scannedFiles: string[] = []

  // Reverse import map para blastRadius
  const importMap = buildImportMap(files)
  const reverseMap = new Map<string, number>()
  for (const deps of importMap.values()) {
    for (const dep of deps) {
      reverseMap.set(dep, (reverseMap.get(dep) ?? 0) + 1)
    }
  }

  for (const [filePath, content] of files) {
    const pf = parseFile(filePath, content)
    if (!pf) continue

    onProgress?.(filePath)
    scannedFiles.push(filePath)

    issues.push(...detectAnyTypes(pf))
    issues.push(...detectConsoleLogs(pf))
    issues.push(...detectEffectNoDeps(pf))
    issues.push(...detectMissingDocs(pf))
    issues.push(...detectGenericNaming(pf))
    issues.push(...detectPropDrilling(pf))

    const deadState = detectDeadState(pf)
    if (deadState) issues.push(deadState)

    const oversized = detectOversized(pf)
    if (oversized) issues.push(oversized)
  }

  issues.push(...detectCircularDeps(files))

  const enriched = enrichIssues(issues, reverseMap)

  return {
    projectPath: '',
    scannedFiles,
    issues: enriched,
    summary: {
      total: enriched.length,
      high: enriched.filter(i => i.impact === 'High').length,
      medium: enriched.filter(i => i.impact === 'Medium').length,
      low: enriched.filter(i => i.impact === 'Low').length,
    },
  }
}

// ─── Worker message handler ───────────────────────────────────────────────────
// Contrato idêntico ao anterior — ProjectView.tsx não precisa de mudanças.

self.onmessage = async (e: MessageEvent) => {
  const { files: filesObj } = e.data
  const filesMap = new Map<string, string>(Object.entries(filesObj ?? {}))

  try {
    const result = await runAnalysis(filesMap, (file: string) => {
      self.postMessage({ type: 'progress', file })
    })
    self.postMessage({ type: 'success', result })
  } catch (error) {
    self.postMessage({ type: 'error', error: String(error) })
  }
}
