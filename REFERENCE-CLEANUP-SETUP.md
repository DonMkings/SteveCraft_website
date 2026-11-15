# SteveCraft reference-image retention: 90 days

## Status: NOT ENABLED
This feature is **code only** until you explicitly deploy it and configure a schedule. No existing images are deleted by merging this PR. **Deletion defaults to OFF**. The intended retention rule is 90 elapsed days from the file's creation timestamp, not 90 days after order completion.

## Safety boundaries
- Cleanup scans **only** the private `design-references` bucket. It never scans the public `footwear-images` catalog bucket.
- Candidate files must be older than 90 days and match SteveCraft's generated path pattern: `<UUID>/1.jpg` through `<UUID>/3.webp`.
- Maximum **100 files per invocation**. Remaining eligible files can be handled in later runs.
- All access uses a private, service-role-only SQL RPC. Browser users cannot call it.
- The Edge Function requires a separate secret `CLEANUP_CRON_SECRET` (at least 32 characters), provided as `x-cleanup-token` in a server-to-server request.
- Both `CLEANUP_DELETE_ENABLED=true` on the server **and** a request body `{"mode":"delete"}` are required to permanently delete files.
- `{"mode":"dry-run"}` only reports counts; it does not reveal filenames or delete files.
- There is **no scheduled job installed** in this PR. Do not send the token from front-end JavaScript or commit it to GitHub.

## 1. Deploy read-only SQL
Run `supabase/reference-cleanup-schema.sql` in the **SteveCraft** Supabase SQL Editor. It creates the `public.list_expired_design_references` RPC and grants execute only to `service_role`.

Confirm the current user cannot query it with anonymous credentials; it is deliberately server-only.

## 2. Configure private secret
In Supabase Dashboard → Edge Functions → Secrets:
- Add `CLEANUP_CRON_SECRET` with a **new random, unique 32+ character value**. It must be different from the Turnstile secret and Supabase keys.
- Set `CLEANUP_DELETE_ENABLED` to `false` (or leave unset, as false is the default).
- Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to hosted Edge Functions. Do not expose either.

Generate a random secret on Windows with PowerShell:
```powershell
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```
Keep the output private. Do not share it in chat, screenshots or version control.

## 3. Deploy Edge Function
Create a function named `cleanup-reference-images` from:
`supabase/functions/cleanup-reference-images/index.ts`.
Deploy through Supabase Dashboard's Edge Function editor, or with CLI:

```bash
supabase login
supabase link --project-ref ptczxibbuksvojeabirn
supabase functions deploy cleanup-reference-images --no-verify-jwt
```

**JWT verification must be OFF** for this server-to-server function; it uses `x-cleanup-token` authorization instead. Never allow browser CORS or place its token into `index.html`, `app.js`, or other public resources.

## 4. Test without deletion
The function accepts POST JSON `{"mode":"dry-run"}`, with headers:
- `Content-Type: application/json`
- `x-cleanup-token: <the private CLEANUP_CRON_SECRET>`

Use the Supabase Edge Function test interface **only if it allows adding the private header**. Alternatively invoke from a trusted local PowerShell session:

```powershell
$project = 'ptczxibbuksvojeabirn'
$secret = Read-Host 'Paste CLEANUP_CRON_SECRET (hidden)' -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
try { $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
try {
  Invoke-RestMethod -Method Post -Uri "https://$project.supabase.co/functions/v1/cleanup-reference-images" -Headers @{ 'x-cleanup-token' = $token } -ContentType 'application/json' -Body '{"mode":"dry-run"}'
} finally { Remove-Variable token -ErrorAction SilentlyContinue }
```

Expected response: `mode: dry-run`, `retentionDays: 90`, `deletedCount: 0`, and `eligibleCount`. Current uploads should not be eligible. Test `{"mode":"delete"}` **while `CLEANUP_DELETE_ENABLED=false`**: it should return HTTP 403, never delete.

Review Supabase function logs for failures. Do not use a production customer image to test deletion.

## 5. Enable scheduling only after separate approval
Do **not** enable a deleting schedule until the dry-run results, credential checks, and retention notice are reviewed and approved.

When approved:
1. Set `CLEANUP_DELETE_ENABLED=true` in Supabase Edge Function secrets.
2. Use Supabase Cron / pg_cron + pg_net, with the secret sourced from **Supabase Vault**, to call the function once a day with body `{"mode":"delete"}`. Never embed plaintext credentials in SQL migrations, code, or GitHub.
3. Review the first runs in Edge Function logs, confirm the private bucket contains only retained files, and monitor failures.
4. Document how staff preserves required images separately **before** their 90-day expiry, since this process doesn't know whether a bespoke order is still active.

For a safer initial schedule, run the same cron job with `{"mode":"dry-run"}` while leaving deletion disabled. The manual deletion enablement is a separate release step.

## Operational considerations
- The count is capped at 100; `hasMorePossible: true` indicates additional runs may be needed.
- A file is eligible based on **its storage object creation date**. The function has no knowledge of whether a quote was sent, an order completed, or a photo is still needed. Staff must establish an exception/archive workflow before enabling deletion.
- Retention messaging should be added to the public privacy notice before live deletion.
- If the cleanup function or SQL function is removed, the schedule must be removed separately.
