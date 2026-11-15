# SteveCraft: staff reference-photo viewer

## What this changes
Provides a separate staff-only page at `staff-references.html` to look up customer reference photographs by the Reference ID included in WhatsApp quote enquiries.

- Existing public Design Studio and its upload process remain **unchanged**.
- Photos stay in the **private** Supabase `design-references` bucket.
- An authenticated user must already belong to `public.shop_admins` to access images.
- The viewer creates **five-minute signed URLs**, never permanent public URLs.
- Staff can preview photographs, open them, or copy a short-lived link to share privately with another authorized team member. **Anybody with a signed link can see the image until it expires**, so do not forward it to the public.
- No service-role key or new secrets are embedded in the page.
- No schema changes, additional RLS policies, or new Supabase Edge Functions are needed.

## Before testing
1. Verify the SteveCraft Supabase project still has the `design-references` bucket marked **Private**.
2. Verify the existing policy `Shop admins can read private references` is enabled; do **not** add anonymous read policies. This policy was created by `supabase/reference-images-schema.sql`.
3. Confirm your staff account exists in Supabase **Authentication → Users**, and its User ID is in `public.shop_admins`. If the account only exists in Authentication but is not an authorized admin, it must be denied.
4. If using password sign-in, the account must have a valid password. If using email links, add the full staff viewer URL `https://donmkings.github.io/SteveCraft_website/staff-references.html` to **Authentication → URL Configuration → Redirect URLs**. For VS Code Live Server testing, add the exact localhost URL (e.g. `http://127.0.0.1:5500/staff-references.html`) only while needed.
5. The Supabase Authentication email settings/provider must allow sign-ins. Do not use a personal account's secrets in code.

## Test on feature branch before merge
1. Open `staff-references.html` via VS Code Live Server (or a local static server). Do not open `file://` directly.
2. Sign in with the **existing admin account**; enter the Reference ID from a successful customer quote.
3. Confirm the photos render and a copied signed URL opens successfully in another tab.
4. Wait 5+ minutes and confirm that a fresh private photo link is required to view a new request. Already-loaded images may remain in browser cache; the signed URL itself should expire.
5. Sign out and confirm the viewer hides the photos. Confirm a non-admin account cannot list or sign photos; open a private/incognito window and check unauthenticated visitors cannot retrieve them.
6. Confirm the original quote reference upload still works without any change.
7. Check mobile layout and that no browser console errors appear. Signed URLs must not be recorded in analytics, screenshots or public issue comments.

## Operational notes and limitations
- Staff can look up **only** IDs they already possess; no global customer-photo list is provided.
- The URL to the staff page can be known publicly, but it reveals no customer photos without authorization; this is **access control, not hiding a web page**.
- An image link works for anyone holding it until expiration; treat it as sensitive. Avoid sharing with customers or posting publicly.
- Images can be removed in future by the 90-day retention cleanup after that project has been separately tested and enabled. If an old reference no longer exists, the lookup shows 'No photographs found'.
- This feature does **not** automatically send the image inside WhatsApp. It is a secure convenience for staff opening the actual photograph.
- Supabase Auth sessions may persist on the staff member's browser, so sign out on shared devices.
- No customer photos or log-in credentials should be included in GitHub commits or PR reviews.

## Rollout
Open a separate pull request for this feature. Deploy only after checking that staff-only reads and signed URLs work with actual Supabase RLS, and that the staff account can sign in. No live user data needs to be changed.
