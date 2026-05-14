import Groq from 'groq-sdk'
import { getAuthenticatedUser } from '../_lib/auth'
import { applyRateLimitHeaders, checkRateLimit } from '../_lib/ratelimit'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' })

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let user: { id: string }
  let plan = 'free'
  try {
    const auth = await getAuthenticatedUser(req.headers.authorization)
    user = auth.user
    plan = auth.plan
  } catch (error: any) {
    return res.status(401).json({ error: error.message || 'Unauthorized' })
  }

  const limitResult = await checkRateLimit(user.id, plan)
  applyRateLimitHeaders(res, limitResult)

  if (!limitResult.success) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: plan === 'free'
        ? 'Limite do plano Free atingido (20/hora). Faz upgrade para Pro.'
        : `Limite atingido. Reset: ${new Date(limitResult.reset).toLocaleTimeString('pt-PT')}`,
      reset: limitResult.reset,
    })
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
    const msg = await groq.chat.completions.create({
      model: 'mixtral-8x7b-32768',
      max_tokens: 256,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
    })

    const explanation = msg.choices[0]?.message?.content ?? ''
    return res.status(200).json({ explanation })
  } catch (err: any) {
    console.error('Explain error:', err)
    return res.status(500).json({ error: err.message || 'Failed to generate explanation' })
  }
}
