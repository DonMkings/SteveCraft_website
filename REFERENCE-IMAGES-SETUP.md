# Design Studio photo references — secure setup

## Status
The webpage is implemented on `feature/supabase-gallery-whatsapp-cart`, but uploads **will not work until the following Supabase and Cloudflare deployment steps are completed**. The existing text-only quotation flow works without the new service.

## 1. Private bucket
In the **SteveCraft** Supabase SQL Editor, run `supabase/reference-images-schema.sql`. Check Storage for `design-references` marked **Private**. Do not re-use the public product-photo bucket `footwear-images`. The SQL file creates one admin-read policy: anonymous visitors cannot view/download attachments, and cannot write directly.

## 2. Cloudflare Turnstile
Create a Cloudflare Turnstile widget for SteveCraft website domains. Add `donmkings.github.io` and `localhost` / `127.0.0.1` if the dashboard permits them. Copy **site key** into `reference-upload-config.js` (browser-safe). Keep **secret key** only as a Supabase Edge Function secret called `TURNSTILE_SECRET_KEY`.

## 3. Deploy Edge Function
Function source: `supabase/functions/upload-reference-images/index.ts`.
Using Supabase CLI in this repo (ensure you're logged into the **SteveCraft** project):
```bash
supabase login
supabase link --project-ref ptczxibbuksvojeabirn
supabase secrets set TURNSTILE_SECRET_KEY=YOUR_TURNSTILE_SECRET
supabase secrets set ALLOWED_ORIGINS=https://donmkings.github.io,http://localhost:5500,http://127.0.0.1:5500
supabase functions deploy upload-reference-images --no-verify-jwt
```
The platform normally already provides SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to Edge Functions; confirm in your environment. Never put these secrets in GitHub files or frontend JS. Never turn off Turnstile while JWT verification is disabled; the function must have server-side abuse controls.

**Caution:** `ALLOWED_ORIGINS` is a browser CORS restriction, *not authentication*. Turnstile siteverify is the mandatory server-side check. For public production, add Cloudflare-side or backend rate limits and bot monitoring; Turnstile alone cannot promise protection from every automated upload.

## 4. Staff retrieval
On receiving a quote by WhatsApp or email, find `Reference ID`. Sign into the SteveCraft Supabase **project dashboard** and open Storage > `design-references` > folder `<Reference ID>`. It contains `1.jpg` etc. This is a private bucket: the quote deliberately includes an ID rather than a public download URL.

## 5. Test checklist
- Without images: quote review and WhatsApp/email still work, with **Reference images: None**.
- Select one JPG under 3MB; see thumbnail and remove control.
- Reject unsupported format, file >3MB, and more than three images.
- Select valid photos, complete Turnstile, review and click **Prepare my request**.
- Verify success only after all image uploads succeeded; WhatsApp/email text includes Reference ID.
- Retrieve the images privately in the project dashboard. Check that public URLs do not work.
- Invalid CAPTCHA results in an error, not a false success.
- Do **not** merge to main until deployed/tested.

## Privacy and retention
Uploaded images may persist even if the customer abandons WhatsApp before pressing Send. Before a public launch, publish a retention policy and establish periodic deletion of abandoned and completed reference folders. The feature does not create an order or charge customers.
