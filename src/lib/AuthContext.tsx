import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase, UserProfile } from './supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthContextValue {
  session: Session | null
  profile: UserProfile | null
  loading: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>
  signUpWithGitHub: () => Promise<{ error: Error | null }>
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue>({
  session: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
  signOut: async () => {},
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signUpWithGitHub: async () => ({ error: null }),
})

export const useAuth = () => useContext(AuthContext)

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch profile from the users table
  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.warn('[auth] profile not found:', error.message)
      setProfile(null)
    } else {
      setProfile(data as UserProfile)
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (session?.user?.id) {
      await fetchProfile(session.user.id)
    }
  }, [session, fetchProfile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return { error }
      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Sign in failed') }
    }
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    try {
      // Sign up with Supabase Auth
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError) return { error: signUpError }

      const user = data.user
      if (!user) return { error: new Error('No user returned from signup') }

      // Create user profile record
      const { error: profileError } = await supabase.from('users').insert({
        id: user.id,
        auth_id: user.id,
        name: email.split('@')[0],
        email,
        plan: 'free',
        onboarding_completed: false,
        language: 'pt',
        avatar_url: null,
      })

      if (profileError) {
        console.warn('[auth] failed to create user profile:', profileError.message)
        // Don't fail the signup, just warn
      }

      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Sign up failed') }
    }
  }, [])

  const signUpWithGitHub = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) return { error }
      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('GitHub sign up failed') }
    }
  }, [])

  // ── Bootstrap: get existing session on mount ──
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const s = data.session
      setSession(s)
      try {
        if (s?.user?.id) await fetchProfile(s.user.id)
      } catch (e) {
        console.error('[auth] failed to fetch profile during bootstrap:', e)
      } finally {
        setLoading(false)
      }
    })

    // Listen for Supabase auth state changes (email/password, social)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s)
      if (s?.user?.id) {
        await fetchProfile(s.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [fetchProfile])

  return (
    <AuthContext.Provider value={{ session, profile, loading, refreshProfile, signOut, signIn, signUp, signUpWithGitHub }}>
      {children}
    </AuthContext.Provider>
  )
}
