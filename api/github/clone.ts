import git from 'isomorphic-git'
import http from 'isomorphic-git/http/node'
import { createFsFromVolume, Volume } from 'memfs'
import { getAuthenticatedUser } from '../_lib/auth'
import { githubRequest, parseGitHubRepoUrl } from '../_lib/github'
import { applyRateLimitHeaders, checkRateLimit } from '../_lib/ratelimit'

const TEXT_FILE_PATTERN = /\.(ts|tsx|js|jsx|json|css|html|md)$/i
const IGNORE = new Set(['.git', 'node_modules', 'dist', 'build', '.next', 'coverage'])

function readDir(vol: Volume, dir: string): Record<string, string> {
  const result: Record<string, string> = {}

  for (const entry of vol.readdirSync(dir) as string[]) {
    if (IGNORE.has(entry)) continue

    const fullPath = `${dir}/${entry}`
    const stat = vol.statSync(fullPath)

    if (stat.isDirectory()) {
      Object.assign(result, readDir(vol, fullPath))
      continue
    }

    if (!TEXT_FILE_PATTERN.test(entry)) continue
    result[fullPath.replace('/repo/', '')] = vol.readFileSync(fullPath, 'utf8') as string
  }

  return result
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
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

    const { repoUrl, branch } = req.body ?? {}
    if (!repoUrl) {
      return res.status(400).json({ error: 'Missing repoUrl' })
    }

    const { owner, repo, repoUrl: normalizedRepoUrl } = parseGitHubRepoUrl(repoUrl)
    const repoMeta = await githubRequest<any>(githubToken, `/repos/${owner}/${repo}`)
    const branchName = branch || repoMeta.default_branch || 'main'

    const vol = new Volume()
    const fs = createFsFromVolume(vol)

    await git.clone({
      fs,
      http,
      dir: '/repo',
      url: `${normalizedRepoUrl}.git`,
      ref: branchName,
      singleBranch: true,
      depth: 1,
      onAuth: () => ({
        username: githubToken,
        password: 'x-oauth-basic',
      }),
    })

    return res.status(200).json({
      files: readDir(vol, '/repo'),
      branch: branchName,
    })
  } catch (error: any) {
    const status = error.message === 'Missing authorization' || error.message === 'Invalid token' ? 401 : 500
    return res.status(status).json({ error: error.message || 'Failed to clone GitHub repository' })
  }
}
