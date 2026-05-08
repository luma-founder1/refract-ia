// src/renderer/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const url  = import.meta.env.VITE_SUPABASE_URL  as string
const key  = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !key) {
  console.error('Supabase keys missing!', { url, key })
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
}

console.log('Supabase client initialized with:', url)

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string
  auth_id: string
  name: string
  email: string
  plan: 'free' | 'pro' | 'team' | 'enterprise'
  onboarding_completed: boolean
  language: 'en' | 'pt' | 'es' | 'fr' | 'de'
  avatar_url: string | null
  created_at: string
}
