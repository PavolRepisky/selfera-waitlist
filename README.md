# Selfera waitlist

The pre-launch page for [Selfera](../mobile-app): one email field, your place
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

### Analytics

PostHog, switched on by setting `VITE_POSTHOG_KEY` (and `VITE_POSTHOG_HOST`
for a US project). It records pageviews and clicks on its own, plus
`waitlist_joined`, `waitlist_join_failed`, `waitlist_invalid_email`,
`invite_link_copied` and `invite_link_shared`. People are identified by their
invite code, never their email, with `referred_by` set to the code they came
in on.

It keeps nothing in the browser (`persistence: 'memory'`), so the page needs no
cookie banner and a return visit counts as a new visitor. Session recording is
off. The Privacy Policy says both, so change it with them.

### Policy pages

`privacy.html`, `terms.html`, `support.html` and `delete-account.html` are
plain pages styled by `src/legal.css`, with no script and so no analytics. The
stores and the app link to them at `/privacy`, `/terms`, `/support` and
`/delete-account`, so those addresses mustn't change. A new page also goes in
`vite.config.ts`.

They state what the app and its backend really do. When that changes, such as
a new provider, change them too and update the date at the top.

## Deploy

`npm run build` writes a static site to `dist/`. Host it anywhere (Vercel,
Netlify, Cloudflare Pages) with the `VITE_*` variables set at build time.
Set `VITE_SITE_URL` to the public address so invite links point there.
`vercel.json` turns on clean URLs; another host needs the same setting.

### Shared links

The app shares `selfera.app/era/<id>` and `selfera.app/u/<handle>`. With the
app installed the phone opens it there; without it, `vercel.json` rewrites
both to `open.html`, which names what was shared and shows the store buttons
(only the phone's own store on a phone), plus Open in Selfera for when the
app is installed but the link was opened inside another app's browser.

The phone only hands a link to the app if this site vouches for it:
`public/.well-known/apple-app-site-association` (iOS) and `assetlinks.json`
(Android), served as JSON with no redirect. They claim only `/era/*` and
`/u/*`, so the policy pages always open here. The iOS file names the app as
`2457NT6849.app.selfera` (Team ID, then bundle id). `assetlinks.json` holds
the SHA-256 of Play's app signing key (Play Console → Protected with Play →
Play Store protection → Play app signing), not the upload key. A build
installed from anywhere but Play is signed differently and needs its own
fingerprint added to the list. The app's side and how to check it are in the app's wiki, Deploy
and CI › Shared links.

### Moderation page

`public/moderate.html` is where a report email's buttons land (the app's
`report-alert` function links to it through `MODERATION_PAGE_URL`). It's
copied into the build as it is, with no script from `src/`, so no analytics
run on it, and it asks not to be indexed. The token and the address of the
`moderate` function ride in the link's fragment, which never reaches this
site's server. The function and how acting on a report works are in the
app's repo (`supabase/functions/moderate`, `supabase/README.md`).
