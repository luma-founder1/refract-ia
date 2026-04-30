import fs from 'original-fs'
const fsp = fs.promises
import { existsSync } from 'original-fs'
import path from 'path'

export interface Dependency {
  source: string
  target: string
}

export async function getProjectDependencies(projectPath: string): Promise<Dependency[]> {
  const dependencies: Dependency[] = []
  const IGNORE = new Set(['node_modules', '.git', 'dist', 'out', 'build', '.build', '.next', '.asar'])

  async function scanDir(dir: string) {
    const entries = await fsp.readdir(dir, { withFileTypes: true })
    
    for (const entry of entries) {
      if (IGNORE.has(entry.name)) continue
      
      const fullPath = path.join(dir, entry.name)
      
      if (entry.isDirectory()) {
        await scanDir(fullPath)
      } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        const content = await fsp.readFile(fullPath, 'utf-8')
        const relativeSource = path.relative(projectPath, fullPath)
        
        // Match local imports: from './path' or from '../path'
        const importRegex = /from\s+['"](\.?\.\/[^'"]+)['"]/g
        let match
        while ((match = importRegex.exec(content)) !== null) {
          const importPath = match[1]
          const resolvedPath = path.resolve(path.dirname(fullPath), importPath)
          
          let finalTarget = ''
          const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '.d.ts']
          
          for (const ext of extensions) {
            const testPath = resolvedPath + ext
            if (existsSync(testPath)) {
              const stat = await fsp.lstat(testPath)
              if (!stat.isDirectory()) {
                finalTarget = path.relative(projectPath, testPath)
                break
              }
            }
          }
          
          if (finalTarget && finalTarget !== relativeSource) {
            dependencies.push({ source: relativeSource, target: finalTarget })
          }
        }
      }
    }
  }

  try {
    if (existsSync(projectPath)) {
      await scanDir(projectPath)
    }
    return dependencies
  } catch (err) {
    console.error('CodeMap scan failed:', err)
    return []
  }
}
