// src/workers/analysis.worker.ts
import { Project, Node, SyntaxKind, ts, SourceFile } from 'ts-morph'

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

function makePatch(before: string[], after: string[]): { before: string; after: string } {
  return { before: before.join('\n'), after: after.join('\n') }
}

// Create an in-memory ts-morph Project from provided files
function createTsMorphProject(files: Map<string, string>): Project {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
      strict: true,
      allowJs: true,
    },
  })

  for (const [filePath, content] of files) {
    if (/\.(ts|tsx|js|jsx)$/.test(filePath)) {
      project.createSourceFile(filePath, content, { overwrite: true })
    }
  }

  return project
}

// ─── Detector: Any Types ──────────────────────────────────────────────────────

function detectAnyTypes(sourceFile: SourceFile): Issue[] {
  const issues: Issue[] = []
  const text = sourceFile.getFullText()
  const lines = getLines(text)

  sourceFile.getDescendantsOfKind(SyntaxKind.AnyKeyword).forEach(node => {
    const line = node.getStartLineNumber()
    const lineText = lines[line - 1] ?? ''
    const fixed = lineText
      .replace(/:\s*any\b/g, ': unknown')
      .replace(/as\s+any\b/g, 'as unknown')
      .replace(/<any>/g, '<unknown>')
      .replace(/Array<any>/g, 'Array<unknown>')
      .replace(/any\[\]/g, 'unknown[]')

    issues.push({
      id: `any-${sourceFile.getFilePath()}-${line}`,
      file: sourceFile.getBaseName(),
      filePath: sourceFile.getFilePath(),
      category: 'any-type',
      problem: 'Uso de `any` — substitui por um tipo concreto',
      impact: 'Medium',
      lineStart: line,
      lineEnd: line,
      lines: { before: [lineText], after: [fixed] },
      patch: { before: lineText, after: fixed },
    })
  })

  return issues
}

// ─── Detector: Dead useState ──────────────────────────────────────────────────

function detectDeadState(sourceFile: SourceFile): Issue | null {
  const calls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter(c => c.getExpression().getText() === 'useState')

  const stateDecls: Array<{ varName: string; line: number }> = []

  for (const call of calls) {
    const varDecl = call.getFirstAncestorByKind(SyntaxKind.VariableDeclaration)
    if (!varDecl) continue
    const nameNode = varDecl.getNameNode()
    if (!Node.isArrayBindingPattern(nameNode)) continue
    const first = (nameNode as any).getElements?.()[0]
    const varName = first?.getText?.() ?? ''
    if (!varName) continue
    stateDecls.push({ varName, line: varDecl.getStartLineNumber() })
  }

  if (stateDecls.length === 0) return null

  const dead = stateDecls.filter(({ varName }) => {
    const refs = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).filter(id => id.getText() === varName)
    return refs.length <= 1
  })

  if (dead.length === 0) return null

  const lines = getLines(sourceFile.getFullText())
  const deadLines = dead.map(d => lines[d.line - 1] ?? '')

  return {
    id: `dead-state-${sourceFile.getFilePath()}`,
    file: sourceFile.getBaseName(),
    filePath: sourceFile.getFilePath(),
    category: 'dead-state',
    problem: `${dead.length} estado(s) não usado(s): ${dead.map(d => d.varName).join(', ')}`,
    impact: 'Medium',
    lineStart: dead[0].line,
    lineEnd: dead[dead.length - 1].line,
    lines: { before: deadLines, after: [] },
    patch: { before: deadLines.join('\n'), after: '' },
  }
}

// ─── Detector: Missing JSDoc ──────────────────────────────────────────────────

function detectMissingDocs(sourceFile: SourceFile): Issue[] {
  const issues: Issue[] = []
  const exported = sourceFile.getExportedDeclarations()
  const full = sourceFile.getFullText()
  const lines = getLines(full)

  for (const [name, decls] of exported) {
    for (const decl of decls) {
      // Many declaration nodes expose getJsDocs()
      const hasJs = (decl as any).getJsDocs?.()?.length > 0
      if (hasJs) continue

      let line = 1
      try { line = decl.getStartLineNumber() } catch { line = 1 }
      const code = lines[line - 1] ?? ''

      issues.push({
        id: `docs-${sourceFile.getFilePath()}-${line}`,
        file: sourceFile.getBaseName(),
        filePath: sourceFile.getFilePath(),
        category: 'missing-docs',
        problem: `Export \`${name}\` sem JSDoc`,
        impact: 'Low',
        lineStart: line,
        lineEnd: line,
        lines: { before: [code], after: [`/**`, ` * ${name} — descrição aqui`, ` */`, code] },
        patch: { before: code, after: `/**\n * ${name} — descrição aqui\n */\n${code}` },
      })
    }
  }

  return issues
}

// ─── Detector: Oversized Component ───────────────────────────────────────────

function detectOversized(sourceFile: SourceFile): Issue | null {
  const path = sourceFile.getFilePath()
  if (!/\.(tsx|jsx)$/.test(path)) return null

  const full = sourceFile.getFullText()
  const lines = getLines(full)

  const fnNodes = [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.FunctionExpression),
  ]

  const large: Array<{ name: string; start: number; end: number; size: number }> = []

  for (const fn of fnNodes) {
    const size = fn.getEndLineNumber() - fn.getStartLineNumber()
    if (size < 80) continue
    const hasJsx = fn.getDescendantsOfKind(SyntaxKind.JsxElement).length > 0 || fn.getDescendantsOfKind(SyntaxKind.JsxFragment).length > 0 || fn.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement).length > 0
    if (!hasJsx) continue
    let name = 'Component'
    try { name = (fn as any).getName?.() ?? name } catch {}
    large.push({ name, start: fn.getStartLineNumber(), end: fn.getEndLineNumber(), size })
  }

  if (large.length === 0) {
    if (lines.length < 200) return null
    const preview = lines.slice(0, 12)
    return {
      id: `oversized-${path}`,
      file: sourceFile.getBaseName(),
      filePath: path,
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
  const contextLines = lines.slice(worst.start - 1, Math.min(lines.length, worst.start + 10))
  return {
    id: `oversized-${path}`,
    file: sourceFile.getBaseName(),
    filePath: path,
    category: 'oversized-component',
    problem: `${worst.name} tem ${worst.size} linhas — divide em sub-componentes`,
    impact: worst.size > 200 ? 'High' : 'Medium',
    lineStart: worst.start,
    lineEnd: worst.end,
    lines: { before: contextLines, after: [] },
    patch: { before: '', after: '' },
  }
}

// ─── Detector: Console.log esquecido ─────────────────────────────────────────

function detectConsoleLogs(sourceFile: SourceFile): Issue[] {
  const issues: Issue[] = []
  const lines = getLines(sourceFile.getFullText())

  for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expr = call.getExpression()
    if (!Node.isPropertyAccessExpression(expr)) continue
    const obj = expr.getExpression().getText()
    const name = expr.getName()
    if (obj === 'console' && ['log', 'warn', 'debug', 'info'].includes(name)) {
      const line = call.getStartLineNumber()
      const lineText = lines[line - 1] ?? ''
      issues.push({
        id: `console-${sourceFile.getFilePath()}-${line}`,
        file: sourceFile.getBaseName(),
        filePath: sourceFile.getFilePath(),
        category: 'console-log',
        problem: `\`console.${name}\` esquecido — remove antes de produção`,
        impact: 'Low',
        lineStart: line,
        lineEnd: line,
        lines: { before: [lineText], after: [] },
        patch: { before: lineText, after: '' },
      })
    }
  }

  return issues
}

// ─── Detector: useEffect sem dependency array ─────────────────────────────────

function detectEffectNoDeps(sourceFile: SourceFile): Issue[] {
  const path = sourceFile.getFilePath()
  if (!/\.(tsx?|jsx?)$/.test(path)) return []
  const issues: Issue[] = []
  const lines = getLines(sourceFile.getFullText())

  for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expr = call.getExpression()
    if (expr.getText() === 'useEffect' && call.getArguments().length === 1) {
      const line = call.getStartLineNumber()
      const endLine = call.getEndLineNumber()
      const context = lines[line - 1] ?? ''
      issues.push({
        id: `effect-no-deps-${path}-${line}`,
        file: sourceFile.getBaseName(),
        filePath: path,
        category: 'effect-no-deps',
        problem: 'useEffect sem dependency array — corre em cada render e causa loops',
        impact: 'High',
        lineStart: line,
        lineEnd: endLine,
        lines: { before: [context], after: [] },
        patch: { before: '', after: '' },
      })
    }
  }

  return issues
}

// ─── Detector: Nomenclatura genérica ─────────────────────────────────────────

function detectGenericNaming(sourceFile: SourceFile): Issue[] {
  const issues: Issue[] = []
  const seen = new Set<string>()
  const lines = getLines(sourceFile.getFullText())

  for (const v of sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
    const name = v.getName()
    if (GENERIC_NAMES.has(name)) {
      const line = v.getStartLineNumber()
      const key = `${name}-${line}`
      if (seen.has(key)) continue
      seen.add(key)
      issues.push({
        id: `naming-${sourceFile.getFilePath()}-${line}-${name}`,
        file: sourceFile.getBaseName(),
        filePath: sourceFile.getFilePath(),
        category: 'generic-naming',
        problem: `Nome genérico \`${name}\` — usa um nome que descreva o propósito`,
        impact: 'Low',
        lineStart: line,
        lineEnd: line,
        lines: { before: [lines[line - 1] ?? ''], after: [] },
      })
    }
  }

  // Props destructuring
  for (const objPat of sourceFile.getDescendantsOfKind(SyntaxKind.ObjectBindingPattern)) {
    for (const elem of (objPat as any).getElements?.() ?? []) {
      const name = elem.getName?.() ?? elem.getText()
      if (!GENERIC_NAMES.has(name)) continue
      const line = elem.getStartLineNumber()
      const key = `prop-${name}-${line}`
      if (seen.has(key)) continue
      seen.add(key)
      issues.push({
        id: `naming-prop-${sourceFile.getFilePath()}-${line}-${name}`,
        file: sourceFile.getBaseName(),
        filePath: sourceFile.getFilePath(),
        category: 'generic-naming',
        problem: `Prop genérica \`${name}\` — renomeia para descrever o dado`,
        impact: 'Low',
        lineStart: line,
        lineEnd: line,
        lines: { before: [lines[line - 1] ?? ''], after: [] },
      })
    }
  }

  return issues
}

// ─── Detector: Prop drilling ────────────────────────────────────────────────

function detectPropDrilling(sourceFile: SourceFile): Issue[] {
  const issues: Issue[] = []
  const reported = new Set<string>()
  const lines = getLines(sourceFile.getFullText())

  const candidates = [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration),
  ]

  for (const node of candidates) {
    let name = ''
    let fnNode: any = null

    if (Node.isFunctionDeclaration(node) && node.getName && node.getName()) {
      name = node.getName()!
      fnNode = node
    } else if (Node.isVariableDeclaration(node)) {
      const init = node.getInitializer()
      if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) {
        name = node.getName()
        fnNode = init
      }
    }

    if (!fnNode || !/^[A-Z]/.test(name)) continue

    const hasJsx = fnNode.getDescendantsOfKind(SyntaxKind.JsxElement).length > 0 || fnNode.getDescendantsOfKind(SyntaxKind.JsxFragment).length > 0
    if (!hasJsx) continue

    const param = fnNode.getParameters?.()?.[0]
    if (!param) continue

    let propCount = 0
    let forwardsProps = false

    if (Node.isIdentifier(param.getNameNode?.())) {
      const propSource = param.getName()
      const uniqueProps = new Set<string>()
      for (const pa of fnNode.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)) {
        const obj = pa.getExpression().getText()
        const prop = pa.getName()
        if (obj === propSource) uniqueProps.add(prop)
      }
      for (const sp of fnNode.getDescendantsOfKind(SyntaxKind.JsxSpreadAttribute)) {
        const arg = sp.getExpression()?.getText?.() ?? ''
        if (arg === propSource) forwardsProps = true
      }
      propCount = uniqueProps.size
    } else {
      // object pattern
      const elems = param.getDescendantsOfKind(SyntaxKind.BindingElement)
      const unique = new Set<string>()
      for (const e of elems) {
        unique.add(e.getName?.() ?? e.getText())
      }
      propCount = unique.size
      forwardsProps = propCount >= 4
    }

    if (propCount < 4 && !forwardsProps) continue

    const key = `${sourceFile.getFilePath()}-${fnNode.getStartLineNumber()}-${name}`
    if (reported.has(key)) continue
    reported.add(key)

    const context = lines.slice(Math.max(0, fnNode.getStartLineNumber() - 1), Math.min(lines.length, fnNode.getStartLineNumber() + 4))
    issues.push({
      id: `prop-drilling-${sourceFile.getFilePath()}-${fnNode.getStartLineNumber()}`,
      file: sourceFile.getBaseName(),
      filePath: sourceFile.getFilePath(),
      category: 'prop-drilling',
      problem: forwardsProps
        ? `Provável prop drilling em \`${name}\` — recebe ${propCount} prop(s) e encaminha props para filhos`
        : `\`${name}\` recebe ${propCount} prop(s) — considera reduzir a superfície de props`,
      impact: propCount >= 6 ? 'Medium' : 'Low',
      lineStart: fnNode.getStartLineNumber(),
      lineEnd: fnNode.getEndLineNumber(),
      lines: { before: context, after: [] },
      patch: { before: context.join('\n'), after: '' },
    })
  }

  return issues
}

// ─── Detector: Dependências circulares ───────────────────────────────────────

function detectCircularDeps(project: Project): Issue[] {
  const importMap = new Map<string, string[]>()
  for (const sf of project.getSourceFiles()) {
    const deps = sf.getImportDeclarations()
      .map(imp => imp.getModuleSpecifierSourceFile()?.getFilePath())
      .filter(Boolean) as string[]
    importMap.set(sf.getFilePath(), deps)
  }

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

  for (const file of importMap.keys()) {
    const cycle = findCycle(file, file, new Set())
    if (!cycle) continue
    const key = [...cycle].sort().join('|')
    if (reported.has(key)) continue
    reported.add(key)
    issues.push({
      id: `circular-${key.slice(0, 60)}`,
      file: file.split('/').pop() ?? file,
      filePath: file,
      category: 'circular-dep',
      problem: `Dependência circular: ${cycle.map(f => f.split('/').pop()).join(' → ')}`,
      impact: 'High',
      lineStart: 1,
      lineEnd: 1,
      lines: { before: ['// Dependência circular'], after: [] },
      patch: { before: '', after: '' },
    })
  }

  return issues
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function runAnalysis(
  files: Map<string, string>,
  onProgress?: (file: string) => void,
  opts: { maxFiles?: number; maxDepth?: number } = {}
): Promise<AnalysisResult> {
  const maxFiles = opts.maxFiles ?? DEFAULT_MAX_FILES
  const project = createTsMorphProject(files)
  const issues: Issue[] = []
  const sourceFiles = project.getSourceFiles()

  for (const sourceFile of sourceFiles) {
    onProgress?.(sourceFile.getFilePath())

    issues.push(
      ...detectAnyTypes(sourceFile),
      ...detectConsoleLogs(sourceFile),
      ...detectEffectNoDeps(sourceFile),
      ...detectMissingDocs(sourceFile),
      ...(detectDeadState(sourceFile) ? [detectDeadState(sourceFile)!] : []),
      ...(detectOversized(sourceFile) ? [detectOversized(sourceFile)!] : []),
      ...detectPropDrilling(sourceFile),
      ...detectGenericNaming(sourceFile),
    )
  }

  // Dependências circulares via ts-morph
  issues.push(...detectCircularDeps(project))

  // Enriquecer com effort, blastRadius, priority
  const enriched = enrichIssues(issues, project)

  return {
    projectPath: '',
    scannedFiles: sourceFiles.map(f => f.getFilePath()),
    issues: enriched,
    summary: {
      total: enriched.length,
      high: enriched.filter(i => i.impact === 'High').length,
      medium: enriched.filter(i => i.impact === 'Medium').length,
      low: enriched.filter(i => i.impact === 'Low').length,
    },
  }
}

function enrichIssues(issues: Issue[], project: Project): Issue[] {
  const reverseMap = new Map<string, number>()
  for (const sourceFile of project.getSourceFiles()) {
    for (const imp of sourceFile.getImportDeclarations()) {
      const target = imp.getModuleSpecifierSourceFile()?.getFilePath()
      if (target) reverseMap.set(target, (reverseMap.get(target) ?? 0) + 1)
    }
  }

  const EFFORT_MAP: Record<string, 'low' | 'medium' | 'high'> = {
    'any-type': 'low', 'console-log': 'low', 'missing-docs': 'low',
    'generic-naming': 'low', 'dead-state': 'medium', 'effect-no-deps': 'medium',
    'prop-drilling': 'medium', 'oversized-component': 'high', 'circular-dep': 'high',
  }

  return issues.map(issue => {
    const effort = EFFORT_MAP[issue.category] ?? 'medium'
    const blastRadius = reverseMap.get(issue.filePath) ?? 0
    const impactScore = { High: 3, Medium: 2, Low: 1 }[issue.impact]
    const effortScore = { low: 1, medium: 2, high: 3 }[effort]
    const priority = (impactScore * 10 + blastRadius) / effortScore
    return { ...issue, effort, blastRadius, priority }
  })
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
