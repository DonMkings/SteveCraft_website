# SteveCraft shop — setup and testing

This feature branch adds a public product gallery, size-aware cart, and WhatsApp purchase enquiries. It does **not** charge customers, confirm reservations, or create paid orders.

## Supabase setup (a separate project from LASFADAN)

1. Create a new project in Supabase for SteveCraft.
2. Open SQL Editor and run `supabase/shop-schema.sql`. If you repeat the migration after applying policies, remove the existing policies first or apply the SQL only once.
3. Create an admin in Authentication > Users and insert their real user UUID into `public.shop_admins` using SQL Editor. Never put service-role credentials in website source.
4. In Storage > footwear-images, upload genuine product photos (JPEG/PNG/WebP, under 5MB). Copy each public image URL.
5. In Table Editor > products, add footwear **name, slug, price_naira, category, description, image_url**, optional is_made_to_order, and set is_published=true only after checking the details.
6. In Table Editor > product_variants, add one row per available EU size and the real stock_quantity. Zero means unavailable. Use a product's actual UUID as product_id.
7. In Project Settings > API, copy your public project URL and **publishable key** into `supabase-config.js`. Never use a secret or service_role key in frontend code.
8. Preview the feature branch in a local HTTP server or merge after review to publish through GitHub Pages.

## Customer experience

- Gallery shows only published products and published products' sizes.
- A size is available to add to cart only when it has positive stock.
- Cart is stored in the visitor's browser, not Supabase, and can change independently of live stock.
- WhatsApp prepares a human-readable order enquiry. The user must press **Send** in WhatsApp.
- The business must manually verify availability, final price, delivery, and payment before confirming a purchase.
- Made-to-order enquiries reference the design name and ask SteveCraft for a custom quote. They do not join the ready-made cart.
- Existing Design Studio, Occasion and its quotation flow remain separate.

## QA checklist

- Published products appear; unpublished products do not.
- Product image, title and price display at desktop and mobile widths.
- Filtering/search works with empty results.
- Size with zero stock cannot be added.
- Add two different items and update/remove quantities.
- Change a product's stock in Supabase, reload the page and confirm the cart warns about unavailable items.
- WhatsApp order includes styles, sizes, quantity and indicative total, with no claims of payment or reservation.
- Made-to-order enquiry opens WhatsApp with the product reference.
- Existing Design Studio, occasion/gift fields and quote form still work.
- Inspect browser console for errors and verify Supabase RLS blocks anonymous inserts/updates.

## Before launch

This v1 provides **informational stock checks only**. Several customers could request the same pair before staff respond. Do not represent this as inventory reservation. If instant purchases are added later, use a server-side inventory reservation, validated pricing and payment webhook workflow.
