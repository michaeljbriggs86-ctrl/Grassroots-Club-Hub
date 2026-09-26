# PitchKind Cloudflare web foundation (private pilot)

## What this deploys

`build.py` creates a browser build from the v2.2.35 Android UI, plus the public
Selkent directory and fixture feed. It checks the existing Shooters Hill pilot
scope and fails if under-12 public standings or scores appear in the feed.
The web build fetches its public feed from the same Cloudflare host. It still
uses Supabase Auth, database RLS, and Edge Functions for private club data.
The Android APK still loads bundled UI and fetches its public feeds from GitHub;
it does **not** start loading web content as a consequence of this deploy.

## Develop in the browser first

Edit the shared UI in `app/src/main/assets/`. `build.py` copies only the
approved files into the Worker build. Push reviewed changes to the connected
Git branch to update the protected browser pilot; no APK build is needed for
ordinary browser UI testing. The existing installed APK keeps its bundled
v2.2.35 files until a separate Android release is prepared.

For browser email confirmation and password reset, add the exact URL
`https://test.pitchkind.com/` to Supabase Auth > URL Configuration > Redirect
URLs. Keep the existing `grassrootsclubhub://auth-callback` entry for the
installed Android app. The parent must be allowed through Cloudflare Access
to open the test site after clicking an email link. If confirmation happens
in a different browser, the parent can return to the site and sign in with
their email and password; the stored signup metadata will resume the request.
Test this with a new parent account before treating it as complete.

The build exports a deliberately restricted file set. No signing key, roster
verification file, Supabase service key, untracked source or private player
data belongs in `dist/`. The Supabase publishable key is in the client as
before and is not an administrator key.

## Connect the existing Cloudflare Worker

The failed 2026-09-26 `grassroots-club-hub.production` build ran Wrangler at
the repository root, which has no deployable static directory. Configure
the existing **Worker** project as follows, once this source is in its Git
branch:

| Setting | Value |
| --- | --- |
| Worker name | `grassroots-club-hub` |
| Root directory | `cloudflare/web-app` |
| Build command | `python3 build.py` |
| Deploy command | `npx wrangler deploy` |
| Production branch | The reviewed branch containing this directory |
| Build watch paths | `cloudflare/web-app/**`, `app/src/main/assets/**`, `data/directory.json`, `data/results.json`, `verification/verify_pilot_scope.py`, `verification/pilot_active_roster.json` |

`wrangler.jsonc` keeps `workers_dev` and version URLs off and has no public hostname. Before
attaching `test.pitchkind.com` (or an equivalent pilot host), protect the
**entire Worker** with Cloudflare Access and permit only named pilot testers.
Then connect the hostname in Cloudflare. If the project is Pages rather than
Workers Builds, create a Worker project for this configuration; a Pages deploy
command and output folder are different.

## Checks before changing the Android app

1. Run `python3 cloudflare/web-app/build.py` from the repository root and
   confirm `cloudflare/web-app/dist/index.html`, `pilot-rights-runtime.js`
   and `data/*.json` are produced. The script intentionally does not write to
   the Android source assets.
2. After a protected Cloudflare deploy, test the site in a browser while
   signed into Cloudflare Access: login, parent sibling-only visibility,
   coach access, fixtures, contrast and screen sizes. A browser has no native
   Android bridge: calendar has a web fallback, while native sharing and
   certain live Selkent page rendering may differ.
3. Review the browser's network log. Public fixture JSON should be loaded
   from the site's own `/data/` path. Private requests must go directly to
   Supabase with the logged-in user's session. The web service worker may only
   cache the listed static UI files, never feeds, auth callbacks or Supabase.
4. Keep U7–U11 scores, results and tables inaccessible to parents in both
   the API and the UI. Verify this with test accounts before inviting anyone.

Once those pass, a separate Android source change can switch the WebView from
`file:///android_asset/index.html` to an approved Cloudflare URL and be
released as a newly tested APK. Browser-only testing does not verify the
Android native sharing, sign-in callback, storage or offline behaviour.

## Confirmation email branding

`email-templates/confirm-signup.html` is a reviewable Supabase Auth **Confirm
sign up** email body. Suggested subject: `Confirm your PitchKind email`. The
HTML has inline colours and no remote images because the pilot host is behind
Cloudflare Access; email clients cannot load a logo from that private host.
The sender should display as PitchKind from an authenticated `pitchkind.com`
mailbox after outbound email is configured. A public PNG export of the
approved primary logo can be added later, when publicly hosted.

For hosted Supabase, paste this HTML into Authentication > Email Templates >
Confirm sign up, then send a test confirmation to an authorised test address.
The email is managed by Supabase: pushing this file to Git does **not** update
the live email. Check the project's template editing and mail settings before
changing the dashboard. New Free projects on Supabase default SMTP cannot
customise auth templates; custom SMTP allows it. The default SMTP also only
sends to pre-authorised project addresses at a low rate, so configure an
appropriate sender before inviting parents outside the pilot.

Keep `{{ .ConfirmationURL }}` intact in both links. Supabase generates the
confirmation URL with the redirect appropriate to the signup request: browser
signups return to `https://test.pitchkind.com/`, Android signups retain the
`grassrootsclubhub://auth-callback` redirect. Test one of each before considering
the email live. The current Android confirmation Worker source is separate;
no new redirect endpoint or change to the installed APK is required for this
email template.
