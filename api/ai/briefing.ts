import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { projectPath, issues, scannedFiles, guidelines } = req.body

  const total = issues.length
  const high = issues.filter((i: any) => i.impact === 'High').length
  const medium = issues.filter((i: any) => i.impact === 'Medium').length
  const low = issues.filter((i: any) => i.impact === 'Low').length

  const topIssues = issues
    .sort((a: any, b: any) => (b.priority ?? 0) - (a.priority ?? 0))
    .slice(0, 5)
    .map((i: any) => `- ${i.category}: ${i.problem}`)
    .join('\n')

  const systemPrompt = `És o Refract, um assistente de qualidade de código.
Gera um briefing curto (máximo 3 frases) sobre o estado do projeto analisado.
Menciona os problemas mais críticos encontrados e o impacto geral.
Responde sempre em português europeu. Tom direto, sem floreados.`

  const userPrompt = `Projeto: ${projectPath}
Ficheiros analisados: ${scannedFiles.length}
Issues: ${total} total (${high} high, ${medium} medium, ${low} low)

Top issues:
${topIssues}
${guidelines ? `\nGuidelines:\n${guidelines}` : ''}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const content = response.content[0]
    const briefing = content.type === 'text' ? content.text : ''
    return res.status(200).json({ briefing })
  } catch (err: any) {
    console.error('Briefing error:', err)
    return res.status(500).json({ error: err.message || 'Failed to generate briefing' })
  }
}
