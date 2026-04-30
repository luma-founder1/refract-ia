// src/main/engine/analysis.ts
import fs from 'original-fs'
import path from 'path'
import { parse } from '@typescript-eslint/parser'
import { AST_NODE_TYPES } from '@typescript-eslint/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Issue {
  id: string
  file: string
  filePath: string
  category: 'oversized-component' | 'any-type' | 'dead-state' | 'missing-docs'
  problem: string
  impact: 'High' | 'Medium' | 'Low'
  lineStart: number
  lineEnd: number
  lines: { before: string[]; after: string[] }
}

export interface AnalysisResult {
  projectPath: string
  scannedFiles: string[]
  issues: Issue[]
  summary: { total: number; high: number; medium: number; low: number }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const IGNORE = new Set(['node_modules', '.git', 'dist', 'build', '.build', '.next', 'out', 'coverage', '.turbo', '.vercel', 'temp', 'tmp', '.asar'])

// ─── File utils ───────────────────────────────────────────────────────────────

const MAX_FILES = 500

async function walkTs(dir: string, out: string[] = [], depth = 0): Promise<string[]> {
  if (depth > 8 || out.length >= MAX_FILES) return out
  try {
    const items = await fs.promises.readdir(dir)
    for (const item of items) {
      if (out.length >= MAX_FILES) break
      if (IGNORE.has(item)) continue
      const full = path.join(dir, item)
      try {
        const stat = await fs.promises.stat(full)
        if (stat.isDirectory()) await walkTs(full, out, depth + 1)
        else if (/\.(tsx?|jsx?)$/.test(item)) out.push(full)
      } catch {}
    }
  } catch {}
  return out
}

async function readSource(filePath: string): Promise<string> {
  try { return await fs.promises.readFile(filePath, 'utf-8') } catch { return '' }
}

function getLines(source: string): string[] {
  return source.split('\n')
}

function parseAst(source: string, filePath: string) {
  try {
    return parse(source, {
      jsx: true,
      loc: true,
      range: true,
      tolerant: true,
      filePath,
    })
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
    if (Array.isArray(child)) child.forEach(c => walk(c, visitor))
    else if (child && typeof child === 'object' && child.type) walk(child, visitor)
  }
}

// ─── Detector: Any Types (AST) ────────────────────────────────────────────────

function detectAnyTypes(filePath: string, source: string, lines: string[]): Issue | null {
  const ast = parseAst(source, filePath)
  if (!ast) return null

  const anyNodes: Array<{ line: number; col: number; context: string }> = []

  walk(ast, (node) => {
    if (node.type === AST_NODE_TYPES.TSAnyKeyword && node.loc) {
      const line = node.loc.start.line
      anyNodes.push({
        line,
        col: node.loc.start.column,
        context: lines[line - 1] ?? '',
      })
    }
  })

  if (anyNodes.length === 0) return null

  const uniqueLines = [...new Map(anyNodes.map(n => [n.line, n])).values()]
  const first = uniqueLines[0]
  const preview = uniqueLines.slice(0, 6)

  return {
    id: `any-${filePath}`,
    file: path.basename(filePath),
    filePath,
    category: 'any-type',
    problem: `${anyNodes.length} uso${anyNodes.length !== 1 ? 's' : ''} de \`any\` — substitui por tipos concretos`,
    impact: anyNodes.length > 4 ? 'High' : 'Medium',
    lineStart: first.line,
    lineEnd: preview[preview.length - 1].line,
    lines: {
      before: preview.map(n => n.context),
      after: preview.map(n =>
        n.context
          .replace(/:\s*any\b/g, ': unknown')
          .replace(/as\s+any\b/g, 'as unknown')
          .replace(/<any>/g, '<unknown>')
          .replace(/Array<any>/g, 'Array<unknown>')
          .replace(/any\[\]/g, 'unknown[]')
      ),
    },
  }
}

// ─── Detector: Dead useState (AST) ────────────────────────────────────────────

function detectDeadState(filePath: string, source: string, lines: string[]): Issue | null {
  const ast = parseAst(source, filePath)
  if (!ast) return null

  // Collect all useState declarations
  const stateDecls: Array<{ varName: string; setterName: string; line: number }> = []

  walk(ast, (node) => {
    // const [x, setX] = useState(...)
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

  // Count usages of each var in the source (excluding the declaration line)
  const dead = stateDecls.filter(({ varName, line }) => {
    const sourceWithoutDecl = lines
      .filter((_, i) => i !== line - 1)
      .join('\n')
    const regex = new RegExp(`\\b${varName}\\b`)
    return !regex.test(sourceWithoutDecl)
  })

  if (dead.length === 0) return null

  const deadLines = dead.map(d => lines[d.line - 1] ?? '')

  return {
    id: `dead-state-${filePath}`,
    file: path.basename(filePath),
    filePath,
    category: 'dead-state',
    problem: `${dead.length} estado${dead.length !== 1 ? 's' : ''} não usado${dead.length !== 1 ? 's' : ''}: ${dead.map(d => d.varName).join(', ')}`,
    impact: 'Medium',
    lineStart: dead[0].line,
    lineEnd: dead[dead.length - 1].line,
    lines: {
      before: deadLines,
      after: deadLines.map(() => `// ← estado não utilizado — pode ser removido com segurança`),
    },
  }
}

// ─── Detector: Missing JSDoc (AST) ───────────────────────────────────────────

function detectMissingDocs(filePath: string, source: string, lines: string[]): Issue | null {
  const ast = parseAst(source, filePath)
  if (!ast) return null

  const missing: Array<{ line: number; name: string; code: string }> = []
  const comments = ast.comments ?? []

  const hasJsDocAbove = (targetLine: number): boolean => {
    return comments.some(c =>
      c.type === 'Block' &&
      c.value.startsWith('*') &&
      c.loc &&
      c.loc.end.line === targetLine - 1
    )
  }

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

    if (!name) return
    if (hasJsDocAbove(line)) return

    missing.push({ line, name, code: lines[line - 1] ?? '' })
  })

  if (missing.length === 0) return null

  const first = missing[0]
  const preview = missing.slice(0, 4)

  return {
    id: `docs-${filePath}`,
    file: path.basename(filePath),
    filePath,
    category: 'missing-docs',
    problem: `${missing.length} export${missing.length !== 1 ? 's' : ''} sem JSDoc: ${missing.map(m => m.name).join(', ')}`,
    impact: 'Low',
    lineStart: first.line,
    lineEnd: preview[preview.length - 1].line,
    lines: {
      before: preview.map(m => m.code),
      after: preview.flatMap(m => [
        `/**`,
        ` * ${m.name} — adiciona descrição aqui`,
        ` */`,
        m.code,
      ]),
    },
  }
}

// ─── Detector: Oversized Component (AST) ─────────────────────────────────────

function detectOversized(filePath: string, source: string, lines: string[]): Issue | null {
  if (!/\.(tsx|jsx)$/.test(filePath)) return null

  const ast = parseAst(source, filePath)
  if (!ast) return null

  // Find React components (functions that return JSX) and measure their size
  const largeComponents: Array<{ name: string; lineStart: number; lineEnd: number; size: number }> = []

  walk(ast, (node) => {
    const isFn =
      node.type === AST_NODE_TYPES.FunctionDeclaration ||
      node.type === AST_NODE_TYPES.ArrowFunctionExpression ||
      node.type === AST_NODE_TYPES.FunctionExpression

    if (!isFn || !node.loc) return

    const size = node.loc.end.line - node.loc.start.line
    if (size < 80) return

    // Heuristic: has JSX return
    let hasJsx = false
    walk(node, (child) => {
      if (
        child.type === AST_NODE_TYPES.JSXElement ||
        child.type === AST_NODE_TYPES.JSXFragment
      ) hasJsx = true
    })

    if (!hasJsx) return

    // Get component name
    let name = 'Component'
    if (node.id?.name) name = node.id.name
    else if (node.parent?.id?.name) name = node.parent.id.name

    largeComponents.push({
      name,
      lineStart: node.loc.start.line,
      lineEnd: node.loc.end.line,
      size,
    })
  })

  if (largeComponents.length === 0) {
    // Fallback: file itself is very large
    if (lines.length < 200) return null
  }

  const worst = largeComponents.sort((a, b) => b.size - a.size)[0]

  if (worst) {
    const contextLines = lines.slice(worst.lineStart - 1, worst.lineStart + 10)
    return {
      id: `oversized-${filePath}`,
      file: path.basename(filePath),
      filePath,
      category: 'oversized-component',
      problem: `${worst.name} tem ${worst.size} linhas — divide em sub-componentes focados`,
      impact: worst.size > 200 ? 'High' : 'Medium',
      lineStart: worst.lineStart,
      lineEnd: worst.lineEnd,
      lines: {
        before: contextLines,
        after: [
          `// Divide ${worst.name} em sub-componentes:`,
          `// - ${worst.name}Header`,
          `// - ${worst.name}Body`,
          `// - ${worst.name}Footer (se aplicável)`,
          `//`,
          `// Cada um com responsabilidade única e menos de 80 linhas.`,
          `export const ${worst.name}: React.FC<Props> = (props) => (`,
          `  <div>`,
          `    <${worst.name}Header {...props} />`,
          `    <${worst.name}Body {...props} />`,
          `  </div>`,
          `)`,
        ],
      },
    }
  }

  // File-level fallback
  const preview = lines.slice(0, 12)
  return {
    id: `oversized-${filePath}`,
    file: path.basename(filePath),
    filePath,
    category: 'oversized-component',
    problem: `Ficheiro com ${lines.length} linhas — considera dividir em módulos`,
    impact: lines.length > 300 ? 'High' : 'Medium',
    lineStart: 1,
    lineEnd: lines.length,
    lines: { before: preview, after: preview },
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function runAnalysis(
  projectPath: string,
  onProgress?: (file: string) => void
): Promise<AnalysisResult> {
  const tsFiles = await walkTs(projectPath)
  const issues: Issue[] = []

  for (const filePath of tsFiles) {
    onProgress?.(filePath)
    const source = await readSource(filePath)
    if (!source.trim()) continue
    const lines = getLines(source)

    // Parse and detect (parsing is sync but we yield between files)
    const checks = [
      detectAnyTypes(filePath, source, lines),
      detectDeadState(filePath, source, lines),
      detectMissingDocs(filePath, source, lines),
      detectOversized(filePath, source, lines),
    ]

    for (const issue of checks) {
      if (issue) issues.push(issue)
    }

    // Yield to event loop to keep UI responsive
    await new Promise(resolve => setTimeout(resolve, 0))
  }

  return {
    projectPath,
    scannedFiles: tsFiles,
    issues,
    summary: {
      total: issues.length,
      high:   issues.filter(i => i.impact === 'High').length,
      medium: issues.filter(i => i.impact === 'Medium').length,
      low:    issues.filter(i => i.impact === 'Low').length,
    },
  }
}
