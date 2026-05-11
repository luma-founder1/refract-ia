import React, { useState } from 'react'
import { LogoMark } from '../components/Logo'
import { useAuth } from '../lib/AuthContext'
import { Github, Loader2 } from 'lucide-react'

export const AuthPage: React.FC = () => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [githubLoading, setGithubLoading] = useState(false)

  const { signIn, signUp, signUpWithGitHub } = useAuth()

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!email.trim()) {
        setError('Email is required')
        setLoading(false)
        return
      }
      if (!password) {
        setError('Password is required')
        setLoading(false)
        return
      }

      const { error: err } = await signIn(email, password)
      if (err) {
        setError(err.message || 'Failed to sign in')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!email.trim()) {
        setError('Email is required')
        setLoading(false)
        return
      }
      if (!password) {
        setError('Password is required')
        setLoading(false)
        return
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters')
        setLoading(false)
        return
      }

      const { error: err } = await signUp(email, password)
      if (err) {
        setError(err.message || 'Failed to create account')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleGitHub = async () => {
    setError('')
    setGithubLoading(true)

    try {
      const { error: err } = await signUpWithGitHub()
      if (err) {
        setError(err.message || 'Failed to sign up with GitHub')
        setGithubLoading(false)
      }
    } catch (err) {
      setError('An unexpected error occurred')
      setGithubLoading(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        width: '100%',
        background: 'var(--background)',
        padding: '20px',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 400,
          padding: '48px 32px',
          boxShadow: 'var(--shadow-border)',
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: 32,
          }}
        >
          <LogoMark size={32} className="text-foreground" />
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: 24,
            fontWeight: 600,
            color: 'var(--foreground)',
            textAlign: 'center',
            marginBottom: 8,
            letterSpacing: '-0.02em',
          }}
        >
          {mode === 'signin' ? 'Sign in' : 'Create account'}
        </h1>

        {/* Mode toggle */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            marginBottom: 32,
            background: 'var(--accent)',
            borderRadius: 10,
            padding: 4,
          }}
        >
          <button
            onClick={() => {
              setMode('signin')
              setError('')
            }}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: 8,
              border: 'none',
              background: mode === 'signin' ? 'var(--background)' : 'transparent',
              color: 'var(--foreground)',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Sign in
          </button>
          <button
            onClick={() => {
              setMode('signup')
              setError('')
            }}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: 8,
              border: 'none',
              background: mode === 'signup' ? 'var(--background)' : 'transparent',
              color: 'var(--foreground)',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Sign up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={mode === 'signin' ? handleSignIn : handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Email */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--foreground)',
                marginBottom: 6,
              }}
            >
              Email
            </label>
            <input
              type="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading || githubLoading}
              style={{ height: 40 }}
            />
          </div>

          {/* Password */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--foreground)',
                marginBottom: 6,
              }}
            >
              Password
            </label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading || githubLoading}
              style={{ height: 40 }}
            />
          </div>

          {/* Error message */}
          {error && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                background: 'rgba(255, 85, 119, 0.1)',
                border: '1px solid #ff5577',
                fontSize: 13,
                color: '#ff5577',
              }}
            >
              {error}
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading || githubLoading}
            className="btn btn-primary"
            style={{
              height: 40,
              width: '100%',
              justifyContent: 'center',
              marginTop: 8,
            }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {mode === 'signin' ? 'Signing in...' : 'Creating account...'}
              </>
            ) : mode === 'signin' ? (
              'Sign in'
            ) : (
              'Create account'
            )}
          </button>
        </form>

        {/* GitHub button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0', opacity: 0.5 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>or</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        <button
          onClick={handleGitHub}
          disabled={loading || githubLoading}
          type="button"
          className="btn btn-secondary"
          style={{
            height: 40,
            width: '100%',
            justifyContent: 'center',
          }}
        >
          {githubLoading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              {mode === 'signin' ? 'Signing in...' : 'Signing up...'}
            </>
          ) : (
            <>
              <Github size={16} />
              {mode === 'signin' ? 'Sign in with GitHub' : 'Sign up with GitHub'}
            </>
          )}
        </button>
      </div>
    </div>
  )
}
