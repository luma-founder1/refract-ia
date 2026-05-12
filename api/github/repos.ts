import { getAuthenticatedUser } from '../_lib/auth'
import { applyRateLimitHeaders, checkRateLimit } from '../_lib/ratelimit'
import { githubRequest } from '../_lib/github'

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { user, plan, githubToken } = await getAuthenticatedUser(req.headers.authorization)
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

    if (!githubToken) {
      return res.status(400).json({ error: 'GitHub account not connected' })
    }

    const repos = await githubRequest<any[]>(
      githubToken,
      '/user/repos?sort=updated&per_page=50'
    )

    const normalized = repos.map((repo) => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description,
      private: repo.private,
      language: repo.language,
      default_branch: repo.default_branch,
      updated_at: repo.updated_at,
      html_url: repo.html_url,
    }))

    return res.status(200).json(normalized)
  } catch (error: any) {
    const status = error.message === 'Missing authorization' || error.message === 'Invalid token' ? 401 : 500
    return res.status(status).json({ error: error.message || 'Failed to load GitHub repositories' })
  }
}
