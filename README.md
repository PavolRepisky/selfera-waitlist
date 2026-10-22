# SelfEra waitlist

The pre-launch page for [SelfEra](../mobile-app): one email field, your place
on the list, and an invite link that moves you up three places for each friend
who joins with it.

Vite + TypeScript, no framework. Sign-ups go to Supabase.

The layout started from the Trancewait Framer template; the colours and
shapes are the mobile app's own, from `mobile-app/constants/theme.ts`. The type
is not: Geist for the headline, Inter Tight for the name, Figtree for the rest. The background is a photo
plus a depth map (`public/scene/`) that `src/depth.ts` shifts with the
cursor. The chrome logo is the template's liquid-metal shader
(`src/metal.frag.glsl`), run on `public/logo-mask.png`. To swap the logo,
replace that PNG with any transparent silhouette. The photo is our own
AI-generated image and its depth map was made with Depth Anything V2
(bright = near).

## Setup

```sh
npm install
cp .env.example .env.local   # fill in the Supabase URL and anon key
npm run dev
```

Without keys, `npm run dev` still runs and fakes the sign-up so the layout can
be worked on. A production build with no keys shows an error instead.

### Database

Run `supabase/waitlist.sql` once in the Supabase SQL editor. It can go in the
app's project or a separate one. It is not a migration in `mobile-app` on
purpose, since two repos can't share one project's migration history.

The `waitlist` table has RLS on and no policies, so nobody can read it with
the anon key. The page calls `join_waitlist(email, ref, source)`. It returns
the caller's place, invite code and the list's total. Signing up again with
the same email returns the existing spot.

Exporting the list: Supabase dashboard → Table editor → `waitlist` → Export
to CSV, or `select email, created_at from waitlist order by id`.

## Deploy

`npm run build` writes a static site to `dist/`. Host it anywhere (Vercel,
Netlify, Cloudflare Pages) with the three `VITE_*` variables set at build time.
Set `VITE_SITE_URL` to the public address so invite links point there.
