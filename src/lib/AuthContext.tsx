import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { Session } from '@supabase/supabase-js'
import { H } from 'highlight.run'
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
  continueWithGitHub: () => Promise<{ error: Error | null }>
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
  continueWithGitHub: async () => ({ error: null }),
})

export const useAuth = () => useContext(AuthContext)

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  // Garante que setLoading(false) corre só uma vez — independentemente de qual
  // path (getSession vs onAuthStateChange) terminar primeiro.
  const loadingDone = useRef(false)
  const doneLoading = () => {
    if (!loadingDone.current) {
      loadingDone.current = true
      setLoading(false)
    }
  }

  const fetchProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.warn('[auth] profile not found:', error.message)
        setProfile(null)
        return null
      }
      const nextProfile = data as UserProfile
      setProfile(nextProfile)
      return nextProfile
    } catch (e) {
      console.error('[auth] fetchProfile threw:', e)
      setProfile(null)
      return null
    }
  }, [])

  // Keep a ref to the session so `refreshProfile` doesn't change when `session` object mutates.
  const sessionRef = useRef<Session | null>(null)
  sessionRef.current = session

  const refreshProfile = useCallback(async () => {
    if (sessionRef.current?.user?.id) await fetchProfile(sessionRef.current.user.id)
  }, [fetchProfile]) // `fetchProfile` is stable

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      return { error: error ?? null }
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Sign in failed') }
    }
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError) return { error: signUpError }
      const user = data.user
      if (!user) return { error: new Error('No user returned from signup') }

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
      if (profileError) console.warn('[auth] failed to create user profile:', profileError.message)
      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Sign up failed') }
    }
  }, [])

  const continueWithGitHub = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: { scopes: 'repo read:user', redirectTo: window.location.origin },
      })
      return { error: error ?? null }
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('GitHub sign in failed') }
    }
  }, [])

  // Highlight identify
  useEffect(() => {
    if (!session?.user) return
    H.identify(session.user.email ?? session.user.id, {
      id: session.user.id,
      plan: profile?.plan ?? 'free',
    })
  }, [session, profile?.plan])

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let initialSessionHandled = false

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
      setSession(s)

      // TOKEN_REFRESHED não precisa de re-fetch do profile
      if (event === 'TOKEN_REFRESHED') {
        if (!initialSessionHandled) {
          initialSessionHandled = true
          doneLoading()
        }
        return
      }

      if (s?.user?.id) {
        const providerToken = (s as any).provider_token
        if (providerToken) {
          await supabase
            .from('users')
            .update({ github_token: providerToken })
            .eq('id', s.user.id)
        }
        await fetchProfile(s.user.id)
      } else {
        setProfile(null)
      }

      if (!initialSessionHandled) {
        initialSessionHandled = true
        doneLoading()
      }
    })

    // Fallback: se onAuthStateChange não disparar em 5s, desbloquear
    const fallback = setTimeout(() => {
      if (!initialSessionHandled) {
        initialSessionHandled = true
        doneLoading()
      }
    }, 5000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(fallback)
    }
  }, [fetchProfile])

  return (
    <AuthContext.Provider value={{ session, profile, loading, refreshProfile, signOut, signIn, signUp, continueWithGitHub }}>
      {children}
    </AuthContext.Provider>
  )
}
