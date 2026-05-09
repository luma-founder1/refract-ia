import { createClient } from '@supabase/supabase-js'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' })

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
    const msg = await groq.chat.completions.create({
      model: 'mixtral-8x7b-32768',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      temperature: 0.2,
    })

    const text = msg.choices[0]?.message?.content ?? '{}'

    let patch: { before: string; after: string }
    try {
      patch = JSON.parse(text)
    } catch {
      patch = { before: issue.lines.before?.join('\n') || '', after: text }
    }

    return res.status(200).json({ patch })
  } catch (err: any) {
    console.error('Refactor error:', err)
    return res.status(500).json({ error: err.message || 'Failed to generate refactor' })
  }
}
