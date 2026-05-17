import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { installation_id, state, setup_action } = req.query

  // Ignorar uninstall events
  if (setup_action === 'deleted') {
    return res.redirect('/repos')
  }

  if (!installation_id || !state) {
    return res.status(400).send('Missing installation_id or state')
  }

  const userId = String(state)
  const installationId = Number(installation_id)

  const { error } = await supabase
    .from('users')
    .update({ github_installation_id: installationId })
    .eq('id', userId)

  if (error) {
    console.error('[github/callback] failed to save installation_id:', error.message)
    return res.status(500).send('Failed to save installation')
  }

  console.log(`[github/callback] installation_id ${installationId} saved for user ${userId}`)
  return res.redirect('/repos')
}
