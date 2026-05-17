import React, { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  GitBranch,
  Github,
  Globe,
  Loader2,
  Lock,
  Search,
  X,
} from 'lucide-react'
import { createProject } from '../lib/db'
import { useAuth } from '../lib/AuthContext'
import { useFiles } from '../context/FilesContext'
import {
  cloneGitHubRepo,
  getGitHubBranches,
  getGitHubRepos,
  RateLimitError,
  type GitHubBranch,
  type GitHubRepo,
} from '../lib/api'
import type { Project } from '../shared/types'

interface Props {
  onClose: () => void
  onProjectCreated: (project: Project) => void
  onNavigate?: (page: string, params?: any) => void
}

function getInlineError(error: unknown, fallback: string): string {
  if (error instanceof RateLimitError) {
    return `GitHub rate limit reached. ${error.message}`
  }

  if (error instanceof Error) {
    return error.message
  }

  return fallback
}

export const NewProjectModal: React.FC<Props> = ({ onClose, onProjectCreated, onNavigate }) => {
  const { profile, continueWithGitHub, reconnectGitHub } = useAuth()
  const { setFileMap } = useFiles()

  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [connectingGitHub, setConnectingGitHub] = useState(false)
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [importing, setImporting] = useState(false)
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null)
  const [branches, setBranches] = useState<GitHubBranch[]>([])
  const [selectedBranch, setSelectedBranch] = useState('')

  void onNavigate

  const hasGitHubConnection = Boolean(profile?.github_token)
  const step = !hasGitHubConnection ? 'connect' : selectedRepo ? 'branch' : 'repos'

  useEffect(() => {
    if (!hasGitHubConnection) {
      setRepos([])
      setSelectedRepo(null)
      setBranches([])
      setSelectedBranch('')
      setLoadingRepos(false)
      return
    }

    let cancelled = false

    const loadRepos = async () => {
      setLoadingRepos(true)
      setError(null)

      try {
        const nextRepos = await getGitHubRepos()
        if (!cancelled) setRepos(nextRepos)
      } catch (err) {
        if (!cancelled) {
          setError(getInlineError(err, 'Failed to load GitHub repositories.'))
        }
      } finally {
        if (!cancelled) setLoadingRepos(false)
      }
    }

    loadRepos()

    return () => {
      cancelled = true
    }
  }, [hasGitHubConnection])

  useEffect(() => {
    if (!selectedRepo || !hasGitHubConnection) {
      setBranches([])
      setSelectedBranch('')
      setLoadingBranches(false)
      return
    }

    let cancelled = false

    const loadBranches = async () => {
      setLoadingBranches(true)
      setError(null)

      try {
        const { branches: nextBranches } = await getGitHubBranches(selectedRepo.html_url)
        const defaultBranch = nextBranches.find((branch) => branch.isDefault)?.name ?? selectedRepo.default_branch

        if (!cancelled) {
          setBranches(nextBranches)
          setSelectedBranch(defaultBranch)
        }
      } catch (err) {
        if (!cancelled) {
          setError(getInlineError(err, 'Failed to load repository branches.'))
        }
      } finally {
        if (!cancelled) setLoadingBranches(false)
      }
    }

    loadBranches()

    return () => {
      cancelled = true
    }
  }, [hasGitHubConnection, selectedRepo])

  const filteredRepos = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return repos

    return repos.filter((repo) =>
      [repo.name, repo.full_name, repo.description ?? '', repo.language ?? '']
        .some((value) => value.toLowerCase().includes(needle))
    )
  }, [repos, search])

  const handleConnectGitHub = async () => {
    setError(null)
    setConnectingGitHub(true)

    try {
      const { error: oauthError } = profile?.id
        ? await reconnectGitHub()
        : await continueWithGitHub()
      if (oauthError) {
        setError(oauthError.message || 'Failed to continue with GitHub.')
        setConnectingGitHub(false)
      }
    } catch (err) {
      setError(getInlineError(err, 'Failed to continue with GitHub.'))
      setConnectingGitHub(false)
    }
  }

  const handleSelectRepo = (repo: GitHubRepo) => {
    setError(null)
    setSelectedRepo(repo)
    setBranches([])
    setSelectedBranch('')
  }

  const handleBackToRepos = () => {
    if (importing) return
    setError(null)
    setSelectedRepo(null)
    setBranches([])
    setSelectedBranch('')
  }

  const handleImportAndAnalyse = async () => {
    if (!selectedRepo) {
      setError('Select a repository first.')
      return
    }

    if (!selectedBranch) {
      setError('Select a branch before importing.')
      return
    }

    if (!profile?.id) {
      setError('You must be logged in to import a project.')
      return
    }

    setImporting(true)
    setError(null)

    try {
      const cloneResult = await cloneGitHubRepo(selectedRepo.html_url, selectedBranch)
      setFileMap(new Map(Object.entries(cloneResult.files)))

      let project: Project

      try {
        project = await createProject({
          name: selectedRepo.name,
          path: 'uploaded',
          repo: selectedRepo.html_url,
          branch: cloneResult.branch,
          status: 'Not analysed',
          last_run: null,
        }, profile.id)
      } catch (persistError) {
        console.warn('Failed to persist cloned project in Supabase, using local fallback.', persistError)
        project = {
          id: `local-${Date.now()}`,
          name: selectedRepo.name,
          path: 'uploaded',
          repo: selectedRepo.html_url,
          branch: cloneResult.branch,
          status: 'Not analysed',
          last_run: null,
        }
      }

      onProjectCreated(project)
    } catch (err) {
      setError(getInlineError(err, 'Failed to import repository.'))
    } finally {
      setImporting(false)
    }
  }

  const isBusy = connectingGitHub || importing

  return (
    <>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
        @keyframes pulse { 0% { opacity: 0.3 } 50% { opacity: 0.6 } 100% { opacity: 0.3 } }
        .skeleton { background: var(--surface-strong); border-radius: 8px; animation: pulse 1.5s infinite ease-in-out; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes modalIn { from { opacity: 0; transform: scale(0.96) translateY(8px) } to { opacity: 1; transform: scale(1) translateY(0) } }
      `}</style>

      <div
        onClick={() => {
          if (!isBusy) onClose()
        }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1000,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(4px)',
          padding: 24,
        }}
      >
        <div
          onClick={(event) => event.stopPropagation()}
          className="card"
          style={{
            background: 'var(--canvas)',
            width: '100%',
            maxWidth: 560,
            padding: 32,
            position: 'relative',
            animation: 'modalIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
          }}
        >
          <button
            onClick={onClose}
            disabled={isBusy}
            className="btn btn-ghost btn-sm"
            style={{
              position: 'absolute',
              top: 20,
              right: 20,
              width: 32,
              height: 32,
              padding: 0,
            }}
          >
            <X size={16} />
          </button>

          <div style={{ marginBottom: 24, paddingRight: 36 }}>
            <h2 className="page-title" style={{ fontSize: '22px', fontWeight: 400, letterSpacing: '-0.11px', marginBottom: 8 }}>
              Import Repository
            </h2>
            <p style={{ fontSize: 14, color: 'var(--ink-muted)', lineHeight: 1.5 }}>
              Connect GitHub, pick a repository, and import a branch directly into Refract for analysis.
            </p>
          </div>

          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '12px 16px',
                borderRadius: '8px',
                marginBottom: 20,
                background: 'rgba(207, 45, 86, 0.08)',
                border: '1px solid rgba(207, 45, 86, 0.18)',
                color: 'var(--semantic-error)',
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 14, lineHeight: 1.5 }}>{error}</span>
            </div>
          )}

          {step === 'connect' && (
            <div
              style={{
                padding: 28,
                borderRadius: '12px',
                background: 'var(--surface-card)',
                border: '1px solid var(--hairline)',
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '8px',
                    background: 'var(--canvas-soft)',
                    display: 'grid',
                    placeItems: 'center',
                    color: 'var(--ink)',
                  }}
                >
                  <Github size={22} />
                </div>
                <div>
                  <p style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
                    Connect GitHub
                  </p>
                  <p style={{ fontSize: 14, color: 'var(--ink-muted)', lineHeight: 1.5 }}>
                    Connect your GitHub account to import repositories.
                  </p>
                </div>
              </div>

              <button
                onClick={handleConnectGitHub}
                disabled={connectingGitHub}
                className="btn btn-primary"
                style={{ alignSelf: 'flex-start', gap: 8 }}
              >
                {connectingGitHub ? <Loader2 size={16} className="spin" /> : <Github size={16} />}
                {connectingGitHub ? 'Connecting...' : 'Connect GitHub'}
              </button>
            </div>
          )}

          {step === 'repos' && (
            <div>
              <div style={{ position: 'relative', marginBottom: 18 }}>
                <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-muted)' }} />
                <input
                  className="input"
                  style={{ width: '100%', height: 44, paddingLeft: 40 }}
                  placeholder="Search repositories, descriptions, or languages..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>

              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                  {loadingRepos ? (
                    Array.from({ length: 5 }).map((_, index) => (
                      <div
                        key={index}
                        style={{
                          padding: '16px 18px',
                          borderBottom: index === 4 ? 'none' : '1px solid var(--hairline)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 16,
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div className="skeleton" style={{ width: '38%', height: 13, marginBottom: 10 }} />
                          <div className="skeleton" style={{ width: '72%', height: 11, marginBottom: 10 }} />
                          <div style={{ display: 'flex', gap: 8 }}>
                            <div className="skeleton" style={{ width: 60, height: 11 }} />
                            <div className="skeleton" style={{ width: 78, height: 11 }} />
                            <div className="skeleton" style={{ width: 90, height: 11 }} />
                          </div>
                        </div>
                        <div className="skeleton" style={{ width: 92, height: 34 }} />
                      </div>
                    ))
                  ) : filteredRepos.length === 0 ? (
                    <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                      <p style={{ fontSize: 16, color: 'var(--ink)', marginBottom: 6 }}>No repositories found.</p>
                      <p style={{ fontSize: 14, color: 'var(--ink-muted)', lineHeight: 1.5 }}>
                        Try another search term or reconnect GitHub if the list looks incomplete.
                      </p>
                    </div>
                  ) : (
                    filteredRepos.map((repo, index) => (
                      <div
                        key={repo.id}
                        style={{
                          padding: '16px 18px',
                          borderBottom: index === filteredRepos.length - 1 ? 'none' : '1px solid var(--hairline)',
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: 16,
                          animation: `fadeUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.03}s both`,
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, minWidth: 0 }}>
                            <Github size={15} style={{ flexShrink: 0, color: 'var(--ink)' }} />
                            <span
                              style={{
                                fontSize: 16,
                                fontWeight: 600,
                                color: 'var(--ink)',
                                overflow: 'hidden',
                                whiteSpace: 'nowrap',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {repo.full_name}
                            </span>
                          </div>

                          <p style={{ fontSize: 14, color: 'var(--ink-muted)', lineHeight: 1.5, marginBottom: 10 }}>
                            {repo.description || 'No description provided.'}
                          </p>

                          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                            {repo.language && (
                              <span className="badge badge-muted" style={{ padding: '2px 8px', fontSize: 11 }}>
                                {repo.language}
                              </span>
                            )}
                            <span className="badge badge-muted" style={{ padding: '2px 8px', fontSize: 11, textTransform: 'uppercase' }}>
                              {repo.private ? <Lock size={10} style={{ marginRight: 4 }} /> : <Globe size={10} style={{ marginRight: 4 }} />}
                              {repo.private ? 'Private' : 'Public'}
                            </span>
                            <span style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
                              Updated {new Date(repo.updated_at).toLocaleDateString('en-US')}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleSelectRepo(repo)}
                          className="btn btn-secondary btn-sm"
                          style={{ minWidth: 88, justifyContent: 'center' }}
                        >
                          Import
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 'branch' && selectedRepo && (
            <div>
              <button
                type="button"
                onClick={handleBackToRepos}
                className="btn btn-ghost btn-sm"
                disabled={importing}
                style={{ gap: 6, marginBottom: 16 }}
              >
                <ArrowLeft size={14} />
                Back
              </button>

              <div className="card" style={{ padding: 20, marginBottom: 18 }}>
                <p style={{ fontSize: 13, color: 'var(--ink-muted)', marginBottom: 6 }}>
                  Selected repository
                </p>
                <p style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>
                  {selectedRepo.full_name}
                </p>
                <p style={{ fontSize: 14, color: 'var(--ink-muted)', lineHeight: 1.5 }}>
                  Choose the branch you want to import and analyse.
                </p>
              </div>

              <label style={{ display: 'block', fontSize: 14, color: 'var(--ink)', marginBottom: 8 }}>
                Branch
              </label>

              {loadingBranches ? (
                <div className="card" style={{ padding: 18, marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--ink-muted)' }}>
                    <Loader2 size={16} className="spin" />
                    <span style={{ fontSize: 14 }}>Loading branches...</span>
                  </div>
                </div>
              ) : (
                <div style={{ position: 'relative', marginBottom: 20 }}>
                  <GitBranch size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-muted)' }} />
                  <select
                    className="input"
                    value={selectedBranch}
                    onChange={(event) => setSelectedBranch(event.target.value)}
                    style={{ width: '100%', paddingLeft: 36, appearance: 'none' }}
                    disabled={importing || branches.length === 0}
                  >
                    {branches.map((branch) => (
                      <option key={branch.name} value={branch.name}>
                        {branch.name}{branch.isDefault ? ' (default)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <p style={{ fontSize: 14, color: 'var(--ink-muted)', lineHeight: 1.5 }}>
                  {importing ? 'Importing repository into the analysis flow...' : 'The selected branch will be loaded into memory and saved as a project.'}
                </p>
                <button
                  type="button"
                  onClick={handleImportAndAnalyse}
                  className="btn btn-primary"
                  disabled={loadingBranches || importing || !selectedBranch}
                  style={{ gap: 8, minWidth: 148, justifyContent: 'center' }}
                >
                  {importing ? <Loader2 size={16} className="spin" /> : <GitBranch size={16} />}
                  {importing ? 'Importing...' : 'Import & Analyse'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
