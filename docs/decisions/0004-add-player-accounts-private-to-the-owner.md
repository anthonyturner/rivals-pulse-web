# ADR-0004: Add player accounts that are private to their owner

- **Status:** Proposed
- **Date:** 2026-11-01
- **Deciders:** Anthony (maintainer). He settled the four decisions marked
  "settled" under **Decision** on 2026-11-01. Everything else here is proposed
  from the facts below and waits for his confirmation, which is why the status
  is Proposed. Decision 9 and the items marked "defaults" were adopted by the
  orchestrator after the engineering refinement of #263 and can be overridden
  by him.
- **Related:** epic #151; this issue #262; children #263 (sign-up and account
  page), #264 (link code), #265 (privacy policy), #266 (dashboard), #267 (live
  status), #268 (guides). Also #122 (per-uid read function), #100 (frozen
  overlay objects), #204 (notify-me consent), #209 (server rendering). Overlay
  repo `anthonyturner/rivals_pulse`: issue 388 (unverified `playerName`) and
  issues 1167, 1168, 1169 (link action, policy, live sender).

## In plain words

Today the website has no accounts and holds no personal data about visitors.
This record says how that changes: a player signs in with email and password or
with Discord, proves from the overlay that an in-game identity is theirs, and
then sees their own dashboard and, if they switch it on, their live match.
Nobody else sees any of it. The player can delete the account, and can choose
to also be forgotten by the match database.

## Context

**What is true today**

- The site has no sign-in. The overlay privacy policy says "RivalsPulse has no
  login or accounts of its own" (section 2.1) and "We do not collect your email
  address" (section 2.5). Both stop being true once this ships (#265).
- The overlay uploads one finished match at a time to the Edge Function
  `track-match-history`. The function confirms an Overwolf session token with
  Overwolf and turns the Overwolf username into `recorded_by`, a keyed hash
  (`supabase/functions/track-match-history/index.ts`,
  `supabase/functions/_shared/overwolf-identity.ts`). The policy says that
  code is used only to limit how many matches one user can send (section 2.1).
  No live or heartbeat upload exists.
- `playerName` in the upload body is the client's claim, not a verified fact
  (overlay issue 388; comment in `index.ts`). The in-game uid in
  `match_player.player_uid` is a claim too.
- Per-player data sits in these stores (`docs/supabase.md`, migrations):

  | Store | Holds | Keyed by | Kept |
  | --- | --- | --- | --- |
  | `participants` (and `participant_hero_figures`, which cascades from it) | Every player's scoreboard line in a match; for the recorder also damage, healing and blocked per hero | uid, name, and `recorded_by` | Until the half-season after its own ends, six months at most |
  | `tracked_matches` with `players` | The recorder's own matches: hero, kills, deaths, assists, final hits, result, map, duration | The claimed `playerName`, lower-cased | The newest 5,000 per recorder, with no age limit |
  | `do_not_store` | Uids and names of people who asked to be forgotten | The uid or name | Until removed by hand |
  | Aggregate tables | Anonymous counts only | None | Frozen when their raw rows are purged |

- No store ties "the recorder's own match" to the verified `recorded_by`.
  `participants` has the verified hash but does not say which of its lines is
  the recorder's; `tracked_matches` names the recorder's own match but through
  the claimed name.
- `tracked_matches` and `players` grant `select` to `anon` and `authenticated`
  with a "using (true)" policy, so anyone holding the publishable key can read
  them (migrations `20260731000000` and `20260815000000`; not re-checked
  against the live project). The unmerged overlay branch behind #122
  (`feat/736-per-uid-read-rpc`, migration `20261015000000_player_history_rpc.sql`)
  closes those reads and adds `get_player_history(p_uid)`. That function is a
  public lookup: it takes any uid from the caller, returns the current
  half-season only, at most 500 lines, and is granted to `anon` and
  `authenticated`. It is not an ownership check.
- `forget_player(uid, name)` deletes the matching `participants` lines (their
  `participant_hero_figures` go with them) and adds the uid and name to
  `do_not_store`, which `record_match_participants` and the play-time
  aggregate respect. It does not touch `tracked_matches` or `players`, and
  `track-match-history` writes `tracked_matches` without consulting
  `do_not_store`. It is callable by the service role only.
- Anonymous aggregates are rebuilt from raw rows until their half-season is
  frozen. A frozen half-season keeps the contribution of anyone forgotten
  after the freeze (`docs/supabase.md`, "Hero aggregates").
- The Supabase objects shipped overlays call are frozen: additive changes only
  (`docs/supabase.md`, "Frozen for shipped overlays"). The publishable key
  ships inside the overlay, so row-level security (RLS, database rules about
  who may read which row) stays strict on every table.
- `npm run check:browser-bundle` fails the build if `@supabase/supabase-js`
  reaches the browser (`scripts/check-browser-bundle.mjs`).
- Production renders in the browser: `vercel.json` sends every page to
  `index.csr.html`, so `curl` of a page returns an empty `<app-root>`. (The
  architecture and tech-stack docs say pages are server-rendered; #263a fixes
  them.) The API accepts only GET today and caches answers for five minutes
  (`s-maxage=300`), so a per-user answer must opt out of caching.
- The website privacy page (`/privacy`) says there are no accounts, no login and
  no cookies of its own.

**Why doing nothing is not an option.** The epic's goal is a way for a player
to review their own play and follow a live match without the overlay open. That
needs personal data (an email, a link to an identity) and a rule for who may read what. Left
to each child issue, auth, privacy and deletion would be argued again in every
pull request.

## Decision

**1. Sign-in (settled).** We will use Supabase Auth with two methods: email and
password, and "Sign in with Discord". Supabase Auth keeps the credentials and
the Discord identity in its own `auth` schema; we do not build or store
passwords ourselves. The Discord OAuth application's credentials are named, not
valued, in the repo. Discord community server: https://discord.gg/TtGh6btTr.

**2. What an account stores.** Three things, and nothing more:

- *Sign-in data*, held by Supabase Auth: email (or the Discord identity),
  password hash, timestamps.
- *Account settings* in a new additive `public` table owned by the account
  (`auth.uid()`): today only the live-status opt-in, which defaults to off.
- *The link* to an in-game identity, kept apart from the settings so the
  question of one or several identities (open question 1) stays cheap.

An account stores no copy of match data and no level (settled), and we do not
read the Discord avatar or handle for display. The dashboard shows the in-game
name only (settled).

*Amended 2026-11-01 (maintainer decision, issue 264).* The link now also holds
the in-game name, uid and the Overwolf account avatar address that the desktop
app reports when it issues the code, and the site shows the name and avatar in
the header and on the account page, to the owner only. After linking, the app
re-sends the name and avatar and each replaces the stored one; the uid never
changes, and the app's calls are counted in the hour-long abuse list alongside
code requests. The avatar is stored only if it is an `https` address on an
allow-listed Overwolf host. Level is still not stored or shown: the overlay has
no source for it. The Discord avatar and handle are still not read.

**3. Ownership is proven, never typed.** A link is made only from the overlay's
verified Overwolf session, through the one-time code in #264. A name or uid
typed on the website, or sent in an upload body, never establishes ownership,
because both are unverified claims (overlay issue 388). The dashboard may show
only rows that can be attributed to the account's verified identity; where no
current store can say that (see Context), #264 and #266 close the gap with an
additive change, not by trusting the claimed name.

**4. Visibility: owner-only now, friends-ready (settled).** Every piece of
account data has one owner (the account id). A read is allowed for the owner
and for nobody else. Live status is off until the owner switches it on, and
switching it off clears it. To leave room for sharing later without a rewrite:

- every owner-scoped row carries the owner's account id, and no page, link or
  identifier is derived from the player's identity (no public profile URL);
- reads go through one gate per data kind (RLS policy or a function that checks
  `auth.uid()`), so "friends may read" later means adding a grantee to that one
  gate, not changing stored data;
- a later sharing feature needs the owner's own opt-in per data kind and can be
  withdrawn at any time. That feature is out of scope here.

Live status is the current state of one match, not history. It holds only what
the owner already sees on their own overlay and what the privacy policy allows
us to store: never an opponent's ultimate data, never another player's damage,
healing or accuracy. The server, not the overlay, enforces the opt-in: an
update for an account whose setting is off is refused and not stored. The
finished match still reaches the site through the normal after-match upload.
The dashboard receives live status by polling, not by a browser Realtime
connection (decision 9; default).

**5. How the dashboard gets per-player data, and what that implies.** The
dashboard reads the owner's matches from the existing upload stores, through a
server-side read scoped to the signed-in account's linked identity. We will not
copy match data into a per-account store. The read takes its identity from the
verified link, never from a uid or name supplied by the caller. This is
proposed, not settled.

`get_player_history` from #122 is a public lookup by uid, so it cannot be the
door that makes the dashboard owner-only. Whether it also supplies the
scoreboard half is left open (open question 6).

What the dashboard can therefore show, and for how long:

| Dashboard content | Source | Depth |
| --- | --- | --- |
| Name, wins, kills, deaths, assists, final hits, most-played heroes, records | `tracked_matches` | The newest 5,000 matches; no age limit today |
| Damage, healing and blocked per hero | `participant_hero_figures` | Until the half-season after the match ends, six months at most |
| Anything from the anonymous aggregates | Aggregate tables | Not per-player; never shown as "yours" |

A player's history is therefore as deep as the stores already are. History
beyond six months is a separate decision (open question 2).

**6. Consent wording.** Wording is shown before the data is collected, in plain
words, with no pre-ticked box, and links the privacy policy. The exact text is
settled in #265; the content it must carry is:

- *Creating an account:* what is stored (email or Discord identity), what for
  (signing in), and that we send no marketing email. Sign-in and the link are
  the service the player asked for, not an extra.
- *Linking:* "This connects your account to your in-game identity and the
  matches your overlay uploaded. Only you can see them here."
- *Live status (a separate switch, off by default):* "Show my current match on
  my dashboard. Only you can see it. We keep only the current match and clear it
  when the match ends or you switch this off." Withdrawing is as easy as
  agreeing.
- *Deletion:* each choice states what it removes and what it leaves (below).

Email gathered for #204 (notify me at launch) is a different purpose with its
own consent; it is not merged into accounts.

**7. Deletion: two choices (settled).** The account page offers both, each
behind a confirmation, after the player has signed in again recently.

- *Remove my account.* Deletes the sign-in data, the settings, the link and any
  live state. The uploaded matches stay, because they are community data and
  the anonymous community stats stay. With the link gone, the stored lines can
  no longer be tied to an email. The wording must say that linking a new account
  later brings the same history back.
- *Remove my account and forget me.* Does all of the above and also runs
  `forget_player` with the linked uid and name, which deletes the stored lines
  and stops later uploads storing them. This is not undoable without us removing
  the `do_not_store` entry by hand, and counts already frozen into past
  half-seasons keep their contribution. The wording must say both. The choice is
  for an account that is linked (an unlinked account has nothing to forget).
  Until the link exists (#264) the button is shown disabled with "available once
  you link the desktop app" (default).

The forget step runs first and can safely be repeated. The account is deleted
only after it succeeded, so a failure never leaves stored data with no way to
find it. Making "forget" cover `tracked_matches` and `players` is a required
follow-up (see Open questions, new item a).

**8. Retention of what an account adds.** Sign-in data, settings and the link
last as long as the account and are deleted with it. Live status lasts until the
match ends, the owner switches it off, or a short expiry passes, whichever is
first. The 5,000-match and six-month limits on linked history are the existing
ones (decision 5); this ADR does not lengthen them.

**9. Session model and launch (adopted after the #263 refinement).**

- The login session is held on our server, in an `HttpOnly; Secure;
  SameSite=Lax; Path=/api` cookie. The browser calls `/api/auth/*` and
  `/api/account/*` handlers, written once, runtime-neutral, and mounted in both
  Express and the Vercel function. Each request calls Supabase Auth and PostgREST
  with the publishable key and the user's own token (the PKCE sign-in flow, done
  by hand over `fetch`), so RLS is the real guard. The service-role key is used
  only for account deletion.
- The browser gets no `@supabase/supabase-js`; `scripts/check-browser-bundle.mjs`
  stays unchanged. Every auth and account answer carries `Cache-Control:
  private, no-store`, and every POST checks the `Origin` header against forged
  requests.
- Live status uses polling, not Supabase Realtime in the browser (that would
  need the browser client).
- Discord sign-in goes live on production at once, with no release gate
  (maintainer decision, 2026-11-01, replacing an earlier plan to gate it).
  Email and password follow later (#272). The change that ships sign-in (#270)
  also updates the website privacy page to say what an account stores; the
  overlay policy changes when linking (#264) lands (#265).
- Discord sign-in is allowed on production and localhost only; no wildcard for
  preview deployments.

## Alternatives considered

- **Build our own users table and passwords.** Rejected: we would hold password
  hashes and run reset, rate-limit and breach handling that Supabase Auth
  already provides in the project we use.
- **A separate auth vendor (Clerk, Auth0).** Rejected: a new processor, a new
  dependency (rule 6) and a second user store, for no capability Supabase Auth
  lacks here.
- **Discord only, or email only.** Rejected by the maintainer's decision to
  offer both: Discord-only shuts out players without it, and email-only drops
  the one-click path.
- **Browser `supabase-js` with the session in `localStorage`** (the path
  Supabase documents). Rejected: it breaks the CI rule that keeps Supabase out of
  the browser, and any script on the page can read the tokens.
- **`@supabase/ssr` with a cookie scripts can read.** Rejected: a new
  dependency (rule 6), the token stays readable by scripts, and production is
  browser-rendered, so its main benefit does not apply.
- **Identify the player by typing their in-game name.** Rejected: the name is an
  unverified claim (overlay issue 388), so anyone could take another player's
  history. Only the overlay holds a verified session, so only it can prove
  ownership.
- **Copy the owner's matches into a per-account store.** Rejected for now: a
  second copy of personal data, a bigger deletion surface (every extra table
  must be reached by "forget me"), and its one benefit, history beyond six
  months, is an open question. It can be added later, additively, holding the
  owner's own lines only.
- **Reuse `get_player_history` as the dashboard's door.** Rejected as the
  *access control*: it returns any uid's lines to any caller. See open question 6
  for whether it still supplies data.
- **Live status on by default, or switched on by linking.** Rejected (settled):
  it would show when someone is playing without them choosing to.
- **Live status as a history table of heartbeats.** Rejected: it would collect a
  record of when a person plays, which nothing in the dashboard needs.
- **A public profile page for each player.** Rejected: contradicts owner-only.
  Friends-ready means a future grant, not a public URL.
- **One deletion path, always forget or never forget.** Rejected (settled): the
  first removes a player's choice to keep their anonymous contribution, the
  second ignores a player who wants to be erased.

## Consequences

**What this makes easier**

- One agreed design: later issues build on it instead of re-arguing auth,
  privacy and deletion.
- No password handling of our own, and RLS keyed on `auth.uid()` gives one rule
  for owner-only rows.
- A friends feature later is a new grantee on an existing gate, not a data
  migration.
- No second copy of match data, so deletion and retention stay in the places
  they already live.

**What this makes harder, or costs**

- The project holds personal data for the first time (email addresses, a link
  between an email and a player). The overlay policy's "no accounts, no email"
  sentences become false once linking exists, so #265 ships before or with #264.
  The website privacy page is updated by the change that launches sign-in, because
  accounts exist in production from that day.
- `recorded_by` changes purpose. Today it is a pseudonymous code used only to
  limit uploads; once it joins to an account it points at a person. The policy's
  description of it must change.
- Two new processors appear: Discord for sign-in, and an email sender for
  confirmation and reset messages. Supabase's built-in email sender is meant for
  trying things out, so production likely needs a custom SMTP provider (to be
  checked in #263).
- Sign-up is open to anyone on a public site, so it needs abuse protection, and
  the `authenticated` role stops meaning "trusted": every existing and future
  grant to `authenticated` applies to any stranger who registers. Nothing is
  widened today (`anon` already holds those reads), but no new grant may assume
  otherwise.
- "Only you can see it" cannot be promised for rows in `tracked_matches` and
  `players` while their public reads stay open. Until #122 closes them, the
  dashboard hides nothing that the publishable key could not already read, and
  the policy must say so plainly.
- "Forget me" is incomplete today (`forget_player` skips `tracked_matches` and
  `players`, and the upload function ignores `do_not_store` for them). Fixing it
  changes what a frozen function stores for a forgotten player, without
  changing its name, body or reply.
- Deletion is partly permanent: `do_not_store` entries stay, frozen aggregates
  keep their counts, and deleted rows may live on in Supabase backups until they
  age out (the period depends on the plan and must be checked and stated in the
  policy). Deleting our account does not revoke our access in the player's
  Discord settings; the wording should say how to do that.
- Dashboard depth is limited by the stores: per-hero figures stop at six
  months; older matches show the basic line only.
- Friends-ready costs a little now: an owner id on every row and one read gate
  per data kind, even though only the owner reads.
- The server session costs more server code: handlers, an Origin check on
  every POST, and a session cookie that must stay under 4 KB. A cached answer
  could serve one user's session to another, so every auth answer must be
  `no-store` and that needs a test. Supabase Auth rate-limits by IP and our
  server is the single caller. Browser Realtime is ruled out, so live status
  polls and lags by the polling interval.
- Preview deployments share the live Supabase project, so a sign-up on a
  preview creates a real production user; this is why Discord sign-in is not
  allowed on previews.
- Supabase, Discord and Vercel settings (redirect URLs, the Discord OAuth app,
  environment variables) live in dashboards outside the repo and need the
  maintainer.

**What now has to be true**

- No account-owned table without RLS, and a test shows one user cannot read
  another's rows. No grant to `anon` on account data.
- No dashboard read takes a uid or name from the caller. Ownership comes from
  the verified link.
- No change to a frozen overlay object other than additive ones. The overlay's
  existing upload keeps working unchanged for a player with no account.
- Live status is refused and not stored while the opt-in is off, holds no field
  the privacy policy says is never stored or shared, and is current state only.
- The privacy policy matches what is stored before the first link can be made.
- The service-role key and the Discord credentials stay server-side and are
  named, never valued, in the repo and in logs.

## Open questions

These are open. This ADR does not decide them. Each is carried to the issue that
owns it, which is where it gets answered.

1. **One link code, or several identities per account** (#264). The #264 draft
   plans for one identity per account and one account per identity. That is a
   planning assumption, not a decision; decision 2 keeps the link apart from the
   settings so either answer is cheap.
2. **History retention beyond six months** (#266 for the data, #265 for the
   wording). Today the depth is whatever the stores keep (decision 5).
3. **What a live-status heartbeat stores and how it is purged** (#267).
   Realtime versus polling is decided: polling (decision 9).
4. **Whether the dashboard, or live status, depends on Premium** (#266, #267).
5. **Avatar and level through Rivalstracker (`MarvelRivalsPlayerService`).**
   Deferred by the maintainer. No child owns it; it needs its own issue and, if
   it adds a processor, its own ADR.
6. **Whether `get_player_history` from #122 is reused** for the scoreboard half
   of the dashboard (#266, once #122 lands). Whatever is used, the owner-only
   door is the server-side read of decision 5.

Questions already on the children stay there: email confirmation and reset, how
"remove my account" is proven to detach the history, and the unlinked-overlay
block (#263); code lifetime, attempt limits and a changed Overwolf identity
(#264); a separate Discord section (#265); the definition of a main hero
(#268).

**Found while writing this ADR.** Facts, not decisions, for the owning child:

- a. `forget_player` and the upload path skip `tracked_matches` and `players`.
  The forget button stays disabled until #264, which must cover them.
- b. No store ties a recorder's own match to the verified `recorded_by`, so
  attribution needs an additive change; matches uploaded before it may only be
  attributable by weaker evidence (#264, #266).
- c. The policy says match details are deleted within six months, but
  `tracked_matches` has no age limit (only the 5,000 cap), and the policy does
  not describe its public reads (#265).
- d. Browser bundle guard versus client-side Auth: answered by decision 9
  (server-held session, guard unchanged).
- e. Whether an account that is never used expires (#265).

## Compliance

A reviewer checks a change against this ADR by looking for:

- Every new account table has RLS on and an `auth.uid()` policy, with no `anon`
  grant, and a test that a second user reads nothing of the first.
- No read function or endpoint behind the dashboard or live card with a uid or
  name parameter supplied by the caller.
- No new column, table or function that replaces or renames a frozen overlay
  object; migrations are additive.
- The live-status write checks the opt-in on the server, and a test shows an
  update with the setting off stores nothing.
- Both deletion choices exist, each with its confirmation, and "forget me" calls
  `forget_player` before the account is deleted.
- No level and no Discord avatar or handle appears anywhere on the site. The only
  avatar is the Overwolf account avatar the desktop app reported, stored only when
  it is an `https` address on the allow-list (amended 2026-11-01).
- `@supabase/supabase-js` is absent from the browser build, the session cookie is
  `HttpOnly`, and auth and account answers are `private, no-store`.
- The website privacy page describes accounts, the sign-in cookie and deletion
  in the same change that launches sign-in.
- The privacy policy change (#265) is merged before or with the first link (#264).
- No secret value appears in the repo; credentials are named only.
