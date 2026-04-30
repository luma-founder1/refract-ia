import { createClient } from '@supabase/supabase-js'

/**
 * Supabase client initialization for Refract.
 * Used for authentication and cloud syncing.
 */

// Placeholder keys - will be replaced by environment variables or user config
const SUPABASE_URL = 'https://your-project.supabase.co'
const SUPABASE_ANON_KEY = 'your-anon-key'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
