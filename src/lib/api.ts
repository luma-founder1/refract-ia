import { supabase } from './supabase'
import type { AnalysisIssue, AnalysisResult, ApplyResult } from '../shared/types'

// ─── AI API Proxy ─────────────────────────────────────────────────────────────

export async function explainIssue(issue: AnalysisIssue, fileSource: string, guidelines?: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const response = await fetch('/api/ai/explain', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ issue, fileSource, guidelines }),
  })

  if (!response.ok) throw new Error('Failed to explain issue')
  const data = await response.json()
  return data.explanation
}

export async function refactorIssue(
  issue: AnalysisIssue,
  fileSource: string,
  instruction?: string,
  guidelines?: string
): Promise<{ before: string; after: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const response = await fetch('/api/ai/refactor', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ issue, fileSource, instruction, guidelines }),
  })

  if (!response.ok) throw new Error('Failed to refactor issue')
  const data = await response.json()
  return data.patch
}

export async function generateBriefing(
  projectPath: string,
  issues: AnalysisIssue[],
  scannedFiles: string[],
  guidelines?: string
): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const response = await fetch('/api/ai/briefing', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ projectPath, issues, scannedFiles, guidelines }),
  })

  if (!response.ok) throw new Error('Failed to generate briefing')
  const data = await response.json()
  return data.briefing
}

// ─── Codemap API ─────────────────────────────────────────────────────────────

export async function getProjectDependencies(projectPath: string): Promise<{ dependencies: any[]; allFiles: string[] }> {
  // This will be handled by the worker, no backend needed
  // Placeholder for now
  return { dependencies: [], allFiles: [] }
}

// ─── GitHub API ─────────────────────────────────────────────────────────────

export async function getGitHubRepos(): Promise<any[]> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const response = await fetch('/api/github/repos', {
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
    },
  })

  if (!response.ok) throw new Error('Failed to get GitHub repos')
  return response.json()
}

export async function cloneGitHubRepo(repoUrl: string, destPath: string, branch?: string): Promise<{ branch: string; destPath: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const response = await fetch('/api/github/clone', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ repoUrl, destPath, branch }),
  })

  if (!response.ok) throw new Error('Failed to clone repo')
  return response.json()
}

export async function createGitHubPullRequest(input: {
  projectPath: string
  repoUrl: string
  baseBranch: string
  headBranch: string
  title: string
  body: string
}): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const response = await fetch('/api/github/pr', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(input),
  })

  if (!response.ok) throw new Error('Failed to create PR')
  return response.json()
}
