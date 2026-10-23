// Dependencies are injected so authentication/dispatch failures can be tested offline.
export function createHandler({ env, createClient, fetch: requestFetch }: any) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  }
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers })
  return async (request: Request) => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers })
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
    const token = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
    if (!token) return json({ error: 'unauthorized' }, 401)
    const url = env('SUPABASE_URL')
    const key = env('SUPABASE_SERVICE_ROLE_KEY')
    const owner = env('NETVISUALIZER_OWNER_USER_ID')
    const githubToken = env('BANKSALAD_GITHUB_ACTIONS_TOKEN')
    if (!url || !key || !owner || !githubToken) return json({ error: 'sync_not_configured' }, 503)
    const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    try {
      const { data: auth, error: authError } = await admin.auth.getUser(token)
      if (authError || !auth?.user) return json({ error: 'unauthorized' }, 401)
      if (auth.user.id !== owner) return json({ error: 'forbidden' }, 403)
      const { data, error } = await admin.rpc('enqueue_banksalad_sync', { p_user_id: owner })
      if (error) return json({ error: error.message === 'sync_rate_limited' ? 'sync_rate_limited' : 'request_failed' }, error.message === 'sync_rate_limited' ? 429 : 503)
      const queued = data?.[0]
      if (!queued?.request_id) return json({ error: 'request_failed' }, 503)
      if (queued.should_dispatch) {
        try {
          const response = await requestFetch('https://api.github.com/repos/ksg0694-ops/NetVisualizer/actions/workflows/banksalad-mail-sync.yml/dispatches', {
            method: 'POST',
            headers: { Authorization: `Bearer ${githubToken}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
            body: JSON.stringify({ ref: 'main', inputs: { sync_request_id: queued.request_id } }),
            signal: AbortSignal.timeout(15000),
          })
          if (!response.ok) throw new Error('dispatch_failed')
        } catch {
          // A timed-out dispatch may have reached GitHub. A failed queue entry
          // cannot subsequently be claimed, preventing an untracked import.
          await admin.from('banksalad_sync_requests').update({ status: 'failed', error_code: 'dispatch_failed', finished_at: new Date().toISOString() })
            .eq('id', queued.request_id).eq('user_id', owner).eq('status', 'queued')
          return json({ error: 'dispatch_failed' }, 502)
        }
      }
      return json({ request_id: queued.request_id, status: queued.request_status }, 202)
    } catch {
      return json({ error: 'request_failed' }, 503)
    }
  }
}
