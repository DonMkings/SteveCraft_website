// SteveCraft private 90-day retention cleanup.
// Deploy with JWT verification OFF: this is a server-to-server function.
// Its own mandatory x-cleanup-token check protects both dry-runs and deletion.
// Deletion is OFF by default and requires BOTH a server-side flag and mode=delete.
// Never expose CLEANUP_CRON_SECRET or SUPABASE_SERVICE_ROLE_KEY to the browser.
import { createClient } from 'npm:@supabase/supabase-js@2';

const BUCKET = 'design-references';
const BATCH_LIMIT = 100;

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

async function tokenMatches(candidate: string, expected: string) {
  // Compare SHA-256 digests in constant time; never log or echo either secret.
  const enc = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(candidate)),
    crypto.subtle.digest('SHA-256', enc.encode(expected)),
  ]);
  const a = new Uint8Array(left), b = new Uint8Array(right);
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a[i] ^ b[i];
  return mismatch === 0;
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' });

  const secret = Deno.env.get('CLEANUP_CRON_SECRET');
  if (!secret || secret.length < 32) {
    return json(503, { error: 'Cleanup authorization not configured.' });
  }
  const supplied = request.headers.get('x-cleanup-token') ?? '';
  if (!await tokenMatches(supplied, secret)) return json(401, { error: 'Unauthorized.' });

  let mode: unknown = 'dry-run';
  try {
    const body = await request.json();
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      return json(400, { error: 'Expected JSON object.' });
    }
    mode = (body as Record<string, unknown>).mode ?? 'dry-run';
  } catch {
    return json(400, { error: 'Expected JSON body.' });
  }
  if (mode !== 'dry-run' && mode !== 'delete') {
    return json(400, { error: 'Mode must be dry-run or delete.' });
  }

  const deleteEnabled = Deno.env.get('CLEANUP_DELETE_ENABLED') === 'true';
  if (mode === 'delete' && !deleteEnabled) {
    return json(403, { error: 'Deletion disabled. Only dry-run is permitted.' });
  }

  const projectUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!projectUrl || !serviceKey) {
    return json(503, { error: 'Supabase service credentials not configured.' });
  }

  try {
    const client = createClient(projectUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await client.rpc('list_expired_design_references', {
      p_limit: BATCH_LIMIT,
    });
    if (error) {
      console.error('Reference cleanup lookup failed:', error.message);
      return json(503, { error: 'Could not query eligible references.' });
    }

    const eligible = (data ?? []) as { object_path: string; uploaded_at: string }[];
    if (mode === 'dry-run') {
      console.info('SteveCraft reference cleanup dry-run:', { eligibleCount: eligible.length, limit: BATCH_LIMIT });
      return json(200, {
        mode: 'dry-run',
        retentionDays: 90,
        eligibleCount: eligible.length,
        batchLimit: BATCH_LIMIT,
        hasMorePossible: eligible.length === BATCH_LIMIT,
        deletedCount: 0,
      });
    }

    // Recheck object age and allowed path format immediately before deletion.
    // Supabase SQL RPC also enforces this; never accept object paths from request input.
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\/[1-3]\\.(jpg|png|webp)$/;
    const paths = eligible
      .filter((entry) => pattern.test(entry.object_path) &&
        Number.isFinite(Date.parse(entry.uploaded_at)) &&
        Date.parse(entry.uploaded_at) < cutoff)
      .map((entry) => entry.object_path);

    if (!paths.length) {
      return json(200, { mode: 'delete', retentionDays: 90, eligibleCount: eligible.length, deletedCount: 0 });
    }

    const { data: removed, error: removeError } = await client.storage.from(BUCKET).remove(paths);
    if (removeError) {
      console.error('Reference cleanup storage removal failed:', removeError.message);
      return json(503, { error: 'Storage removal failed; check function logs.' });
    }
    const deletedCount = removed?.length ?? 0;
    console.info('SteveCraft reference cleanup complete:', { requestedCount: paths.length, deletedCount });
    return json(200, {
      mode: 'delete',
      retentionDays: 90,
      eligibleCount: eligible.length,
      requestedCount: paths.length,
      deletedCount,
      batchLimit: BATCH_LIMIT,
      hasMorePossible: eligible.length === BATCH_LIMIT,
    });
  } catch (error) {
    console.error('SteveCraft reference cleanup exception:', error);
    return json(500, { error: 'Cleanup failed; check function logs.' });
  }
});
