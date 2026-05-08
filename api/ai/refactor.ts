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

  const { issue, fileSource, instruction, guidelines } = req.body

  const systemPrompt = `És um especialista em refactorização TypeScript/React.
Devolve APENAS um JSON com formato { "before": "...", "after": "..." }.
O campo "after" deve conter o código corrigido para o problema indicado.
Não incluas explicações. Não uses markdown. Apenas o JSON puro.`

  const userPrompt = `Problema: ${issue.category} — ${issue.problem}
Contexto:
${fileSource || issue.lines.before?.join('\n') || ''}
${instruction ? `\nInstrução adicional: ${instruction}` : ''}
${guidelines ? `\nGuidelines:\n${guidelines}` : ''}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const content = response.content[0]
    const text = content.type === 'text' ? content.text : '{}'

    // Extract JSON from response
    let patch: { before: string; after: string }
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      patch = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text)
    } catch {
      patch = { before: issue.lines.before?.join('\n') || '', after: text }
    }

    return res.status(200).json({ patch })
  } catch (err: any) {
    console.error('Refactor error:', err)
    return res.status(500).json({ error: err.message || 'Failed to generate refactor' })
  }
}
