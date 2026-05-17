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
  reconnectGitHub: () => Promise<{ error: Error | null }>
  saveGitHubToken: (token: string) => Promise<boolean>
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
  reconnectGitHub: async () => ({ error: null }),
  saveGitHubToken: async () => false,
})

export const useAuth = () => useContext(AuthContext)

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  // Debug: log state changes
  useEffect(() => {
    console.log(`[auth] STATE — loading: ${loading}, session: ${session ? 'present (userId: ' + session.user.id.slice(0,8) + '...)' : 'null'}, profile: ${profile ? profile.name : 'null'}`)
  }, [loading, session, profile])

  // Garante que setLoading(false) corre só uma vez — independentemente de qual
  // path (getSession vs onAuthStateChange) terminar primeiro.
  const loadingDone = useRef(false)
  const doneLoading = () => {
    if (!loadingDone.current) {
      loadingDone.current = true
      setLoading(false)
      console.log('[auth] doneLoading — setting loading: false')
    }
  }

  const fetchProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    try {
      console.log(`[auth] fetchProfile — userId: ${userId}`)
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.warn(`[auth] fetchProfile — ERROR: ${error.message}`)
        setProfile(null)
        return null
      }
      const nextProfile = data as UserProfile
      console.log(`[auth] fetchProfile — SUCCESS: ${nextProfile.name}`)
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

  const reconnectGitHub = useCallback(async () => {
    try {
      console.log('[auth] reconnectGitHub — signing out and re-authenticating')
      await supabase.auth.signOut({ scope: 'local' })
      setSession(null)
      setProfile(null)
      loadingDone.current = false
      setLoading(true)
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: { scopes: 'repo read:user', redirectTo: window.location.origin },
      })
      return { error: error ?? null }
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('GitHub reconnect failed') }
    }
  }, [])

  const saveGitHubToken = useCallback(async (token: string): Promise<boolean> => {
    try {
      if (!session?.user?.id) return false
      const { error } = await supabase
        .from('users')
        .update({ github_token: token })
        .eq('id', session.user.id)
      if (error) {
        console.error('[auth] saveGitHubToken — error:', error.message)
        return false
      }
      console.log('[auth] saveGitHubToken — success')
      setProfile(prev => prev ? { ...prev, github_token: token } : prev)
      return true
    } catch (e) {
      console.error('[auth] saveGitHubToken — threw:', e)
      return false
    }
  }, [session])

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
    console.log('[auth] INIT — loading: true, session: null, profile: null')
    let initialSessionHandled = false

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
      console.log(`[auth] onAuthStateChange — event: ${event}, hasSession: ${!!s}, userId: ${s?.user?.id?.slice(0,8) ?? 'null'}`)
      setSession(s)

      // TOKEN_REFRESHED não precisa de re-fetch do profile
      if (event === 'TOKEN_REFRESHED') {
        console.log('[auth] onAuthStateChange — TOKEN_REFRESHED: skipping profile fetch')
        if (!initialSessionHandled) {
          initialSessionHandled = true
          doneLoading()
        }
        return
      }

      if (s?.user?.id) {
        const providerToken = (s as any).provider_token || (s as any).provider_access_token
        console.log(`[auth] OAuth callback — hasProviderToken: ${!!providerToken}, event: ${event}`)
        if (providerToken) {
          console.log('[auth] Saving GitHub token to profile...')
          const { error: saveError } = await supabase
            .from('users')
            .update({ github_token: providerToken })
            .eq('id', s.user.id)
          if (saveError) {
            console.error('[auth] Failed to save GitHub token:', saveError.message)
          } else {
            console.log('[auth] GitHub token saved successfully')
          }
        } else if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          console.warn('[auth] No provider_token in session — GitHub token may not be saved')
        }

        // Tentar buscar perfil
        console.log(`[auth] fetchProfile — userId: ${s.user.id}`)
        const { data: profileData, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', s.user.id)
          .single()

        if (profileError || !profileData) {
          // Perfil não existe — criar automaticamente (ex: OAuth users antes do RLS fix)
          console.warn(`[auth] profile not found (${profileError?.message ?? 'no data'}), creating automatically for user: ${s.user.id}`)
          const { error: insertError } = await supabase.from('users').insert({
            id: s.user.id,
            auth_id: s.user.id,
            name: s.user.user_metadata?.name ?? s.user.email?.split('@')[0] ?? 'User',
            email: s.user.email ?? '',
            plan: 'free',
            onboarding_completed: false,
            language: 'pt',
            avatar_url: s.user.user_metadata?.avatar_url ?? null,
          })
          if (insertError) {
            console.error(`[auth] auto-create profile FAILED: ${insertError.message}`)
            setProfile(null)
          } else {
            console.log('[auth] auto-create profile SUCCESS, re-fetching...')
            // Re-fetch do perfil criado
            const { data: newProfile, error: refetchError } = await supabase
              .from('users')
              .select('*')
              .eq('id', s.user.id)
              .single()
            if (refetchError || !newProfile) {
              console.error(`[auth] re-fetch after auto-create FAILED: ${refetchError?.message ?? 'no data'}`)
              setProfile(null)
            } else {
              console.log(`[auth] fetchProfile — SUCCESS: ${newProfile.name}`)
              setProfile(newProfile as UserProfile)
            }
          }
        } else {
          console.log(`[auth] fetchProfile — SUCCESS: ${(profileData as UserProfile).name}`)
          setProfile(profileData as UserProfile)
        }
      } else {
        console.log('[auth] onAuthStateChange — no user, setting profile: null')
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
        console.log('[auth] FALLBACK TIMEOUT — forcing doneLoading after 5s')
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
    <AuthContext.Provider value={{ session, profile, loading, refreshProfile, signOut, signIn, signUp, continueWithGitHub, reconnectGitHub, saveGitHubToken }}>
      {children}
    </AuthContext.Provider>
  )
}
