import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Validate JWT
  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { issue, fileSource, guidelines } = req.body

  const systemPrompt = `És um especialista em qualidade de código TypeScript/React.
Explica de forma clara e concisa (máximo 2 frases) porque o problema detetado é importante e qual o impacto real no projeto.
Responde sempre em português europeu.
Sê direto — sem introduções nem conclusões genéricas.`

  const userPrompt = `Problema: ${issue.category} — ${issue.problem}
Impacto: ${issue.impact}
Contexto do ficheiro:
${fileSource || issue.lines.before?.join('\n') || ''}
${guidelines ? `\nGuidelines:\n${guidelines}` : ''}`

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      temperature: 0.2,
    })

    const explanation = (msg.content[0] as any)?.text ?? ''
    return res.status(200).json({ explanation })
  } catch (err: any) {
    console.error('Explain error:', err)
    return res.status(500).json({ error: err.message || 'Failed to generate explanation' })
  }
}
