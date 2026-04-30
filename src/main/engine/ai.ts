// src/main/engine/ai.ts
import Groq from 'groq-sdk'
import { config } from 'dotenv'
import path from 'path'
import fs from 'fs'
import type { Issue } from './analysis'

config({ path: path.join(process.cwd(), '.env') })

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const MODEL = 'llama-3.3-70b-versatile'

// ─── Explain issue to user ────────────────────────────────────────────────────

export async function explainIssue(issue: Issue, fileSource: string): Promise<string> {
  const snippet = fileSource.split('\n')
    .slice(Math.max(0, issue.lineStart - 5), issue.lineEnd + 5)
    .join('\n')

  const res = await groq.chat.completions.create({
    model: MODEL,
    max_tokens: 300,
    messages: [
      {
        role: 'system',
        content: `És um assistente de code review. Explica problemas de código de forma clara e directa em português. Máximo 3 frases. Não uses markdown.`,
      },
      {
        role: 'user',
        content: `Ficheiro: ${issue.file}\nProblema detectado: ${issue.problem}\n\nCódigo relevante:\n${snippet}\n\nExplica este problema e o impacto que tem no projecto.`,
      },
    ],
  })

  return res.choices[0]?.message?.content?.trim() ?? issue.problem
}

// ─── Generate briefing after scan ────────────────────────────────────────────

export async function generateBriefing(
  projectPath: string,
  issues: Issue[],
  scannedFiles: string[]
): Promise<string> {
  const summary = {
    total: issues.length,
    high: issues.filter(i => i.impact === 'High').length,
    medium: issues.filter(i => i.impact === 'Medium').length,
    low: issues.filter(i => i.impact === 'Low').length,
    files: [...new Set(issues.map(i => i.file))],
  }

  const projectName = projectPath.split('/').pop() ?? 'projecto'

  const res = await groq.chat.completions.create({
    model: MODEL,
    max_tokens: 200,
    messages: [
      {
        role: 'system',
        content: `És o Refract, um agente de qualidade de código. Fala em português, de forma directa e confiante. Não uses markdown nem listas. Fala como um engenheiro sénior a dar feedback.`,
      },
      {
        role: 'user',
        content: `Acabei de analisar o projecto "${projectName}". Analisei ${scannedFiles.length} ficheiros e encontrei ${summary.total} problemas: ${summary.high} críticos, ${summary.medium} médios, ${summary.low} baixos. Os ficheiros mais problemáticos são: ${summary.files.slice(0, 3).join(', ')}. Gera um briefing curto (máximo 3 frases) para o developer antes de ele começar a rever as sugestões.`,
      },
    ],
  })

  return res.choices[0]?.message?.content?.trim() ?? `Analisei ${scannedFiles.length} ficheiros e encontrei ${summary.total} problemas.`
}


