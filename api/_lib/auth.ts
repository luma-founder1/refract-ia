import { createClient, type User } from '@supabase/supabase-js'

type PlanName = 'free' | 'pro' | 'team' | 'enterprise'

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export interface AuthenticatedUserContext {
  user: User
  plan: PlanName
  githubToken: string | null
}

function getServerSupabase() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase server credentials are not configured')
  }

  return createClient(supabaseUrl, serviceRoleKey)
}

export async function getAuthenticatedUser(authHeader: string | undefined): Promise<AuthenticatedUserContext> {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing authorization')
  }

  const token = authHeader.replace('Bearer ', '')
  const supabase = getServerSupabase()

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) {
    throw new Error('Invalid token')
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('plan, github_token')
    .eq('id', user.id)
    .single()

  if (profileError) {
    throw new Error('Unable to load user profile')
  }

  return {
    user,
    plan: (profile?.plan as PlanName | undefined) ?? 'free',
    githubToken: profile?.github_token ?? null,
  }
}
