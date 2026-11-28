# ADR-0006: Publish opted-in player names on Pulse Records

- **Status:** Accepted on 2026-11-07. The maintainer decided on 2026-11-07 that
  the page is called Pulse Records at `/records`, that a name shows only for a
  linked player who switched a new setting on (off by default), that other
  records count and show as "Anonymous" or are left off as the children define,
  that the data comes only from the site's own uploads, and that `participants`
  stays closed (decisions 1, 2, 3 and 5 below, in outline). The detail comes from
  the engineering refinement of issue 564 and was adopted under rule 14: the
  two-key naming rule, "the name comes from the link, not the scoreboard line",
  the list of what is never shown, the defaults in decision 4 and the mechanism
  in decision 6. The maintainer can override any of it, and a change must amend
  this record and the website copy together. **Amended on 2026-11-08:** the
  maintainer decided that the pages (issue 567) and the account switch (issue
  568) ship before overlay issue 1386 updates the desktop app policy, and that
  the policy update follows in that issue. The website's `/privacy` section on
  Pulse Records is the notice in the meantime. See Compliance.
- **Date:** 2026-11-07
- **Deciders:** Anthony (maintainer).
- **Related:** issue 564 (Pulse Records) and its children: this issue 565, 566
  (the read), 567 (the pages), 568 (the account switch). Amends decision 4 of
  [ADR-0004](0004-add-player-accounts-private-to-the-owner.md) for one
  purpose only. Overlay repo `anthonyturner/rivals_pulse`: issue 388
  (unverified `playerName`) and issue 1386 (the privacy policy change for this
  record).

## In plain words

The site is about to get a public page, Pulse Records, that lists the best
single-match figures from the matches the desktop app uploaded: most kills,
most assists and so on. Until now nothing on the site was public about one
player, and ADR-0004 promised that account data is for its owner alone. This
record makes one deliberate exception: a player who has linked their account
may switch on "Show me in Pulse Records", and then their in-game name appears
beside their own entries. It is off until they switch it on, and they can switch
it off at any time.

The page also lists entries from players who have not agreed to anything. Their
lines are shown as "Anonymous". That is still publishing a line from a match
they played, and the policy has to say so plainly.

## Context

- ADR-0004 decision 4 says every piece of account data has one owner, a read is
  allowed for the owner and for nobody else, and no page, link or identifier is
  derived from the player's identity (no public profile URL). It also says a
  later sharing feature "needs the owner's own opt-in per data kind and can be
  withdrawn at any time". Pulse Records is that kind of feature, so the opt-in
  and withdrawal rules already exist; the part that needs amending is "nobody
  else" for the in-game name.
- The website privacy page (`/privacy`) and the account page promise things that
  stop being true once a name can appear: that the site never publishes names,
  player ids or individual matches, that a figure needs a minimum number of
  matches, and that nothing on the account page is shown to anyone else
  (`src/app/features/privacy/privacy-page.component.html`,
  `src/app/features/account/account-page.component.html`).
- `participants` holds every player's scoreboard line, including the lines of
  people who never installed the app, and `participants.recorded_by` carries the
  verified uploader on every line. `read_own_dashboard()` already names a line
  as the owner's only when `recorded_by` matches the link's recorder and `uid`
  matches the link's player (ADR-0004 decision 5, amended).
- The name and uid held in `player_links` are claims made by the desktop app
  when the link is issued, not proof (overlay issue 388). The two-key match
  proves who uploaded a line; it does not prove who owns the name. A modified
  client could link a famous player's name, opt in and upload inflated lines.
  That risk is reputational, not a leak of data.
- The desktop app's privacy policy (`docs/privacy-policy.md` in
  `anthonyturner/rivals_pulse`, last updated 4 November 2026) conflicts in
  several places; see **Compliance** for the list and the issue filed for it.

## Decision

**1. One exception to "owner-only", and only for the in-game name.** ADR-0004
decision 4 stands for every other piece of account data. The single exception
is that the in-game name stored in a player's link may be shown on the public
Pulse Records page. No email, account id, avatar, Discord detail, uid, recorder
code, match time or match is ever shown there, and no page for an individual
player is created.

**2. The name is opt-in, off by default and withdrawable.** A name is shown only
when all of these hold at the moment the page is read:

- the line was uploaded by the linked player's own app (`recorded_by` matches
  the link's recorder) and carries the link's player (`uid` matches the link's
  player), the same two-key rule as `read_own_dashboard()`;
- that account's setting "Show me in Pulse Records" is on. It is stored per
  account, owner-only, defaults to off, is never pre-ticked, and is switched
  off as easily as it was switched on;
- the uid and name are not on the `do_not_store` list.

The name shown is the one stored with the link, never the name in the scoreboard
line. A name stops showing when the player switches the setting off, unlinks,
or deletes the account, and the page must not keep it longer than a couple of
minutes after that (a short shared-cache lifetime, not the site default).

**3. Anonymous lines are still published, and the policy says so.** The Kills,
Assists and Final Hits boards include lines whose uid is not linked to any
account, including people who never installed the app and never agreed to this.
Such an entry shows the hero and the figure and the word "Anonymous", with no
name, uid or match. It is still a published line from a match that person
played, and someone who played in that match may recognise it. The privacy page
says exactly that. This change **extends** the legal basis the desktop app
policy gives today. That policy (section 8) rests the storing and showing of
scoreboard lines on legitimate interests, limited to giving app users match
statistics and lookups, and its sections 1, 3 and 4 limit who sees the lines to
other app users. Showing a line on a public website page goes beyond that, so
the basis has to be extended to public display, with the same limits (only what
every player in the match already sees in the game, short retention, deletion on
request). The in-game name, which is the extra step, rests on the player's
consent. This records what the project intends and is not legal advice.

**4. Defaults for the questions the refinement left open (adopted, overridable).**

- Damage, Healing and Damage Blocked come only from the uploading player's own
  line, because the app uploads those figures for no one else. Those boards
  show opted-in players only; they never show an anonymous row.
- Every linked player's lines are either named or left off, never shown as
  "Anonymous". A linked player who has not opted in is left off. A linked
  player's lines that someone else uploaded are left off whether or not they
  opted in, because only the player's own app proves the line is theirs and
  showing them as "Anonymous" would put the same person on the board twice.
- Only Quick Match and Competitive count. Ties go to the earlier match. There is
  no half-season selector, no date, no filter and no match link.

**5. Data comes only from the site's own overlay uploads, through one narrow
read.** No outside data, and no change to the row-level security of
`participants`: it stays closed to `anon` and `authenticated`. The read returns
only hero, figure and a name or null for each row, never a uid, recorder code,
line id or match time. Building it is issue 566.

**6. Retention follows the lines.** A Pulse Records entry is read live from
`participants`, so it disappears when its line is purged (the half-season after
its own ends, six months at most), when `forget_player` deletes it, or when the
uid goes on `do_not_store`. No second copy of any entry is stored. The page
states "Matches since" the earliest date it covers, taken from the data.

## Alternatives considered

- **Show names to everyone by default.** Rejected: it publishes a person's name
  and best play without asking, and contradicts the opt-in rule ADR-0004
  already set for sharing.
- **Only linked, opted-in players, with no anonymous entries.** Not chosen: the
  maintainer's decision was that other records count and show as "Anonymous", and
  the board would be nearly empty while few players link. It is the safer option
  for people who never agreed, and the one to fall back to if the anonymous lines
  turn out to cause harm.
- **A precomputed records table refreshed by a schedule.** Rejected: a second
  copy of personal data that every deletion path would have to reach, which
  ADR-0004 rejected for the dashboard too, and names that stay stale after an
  opt-out.
- **Rank the lines in TypeScript on the server.** Rejected: uids would leave the
  database.
- **A public profile page per player.** Rejected, as in ADR-0004: Pulse Records
  names a player on a list, it does not create an address for them.
- **Require two independent uploaders before a line counts.** Rejected for now:
  a second upload of the same match is dropped without a trace today, so it
  cannot be measured, and a determined person can get around it.

## Consequences

**What this makes easier**

- The opt-in, the withdrawal and the two-key naming rule are decided once, so
  issues 566 and 568 build against one agreed rule and the copy is reviewed
  against one record.
- The website says plainly what it publishes, including about people who did
  not consent.

**What this makes harder, or costs**

- The site publishes a player's name for the first time. The account page and
  privacy page can no longer say "to you only" without an exception, and the
  desktop app's policy has to change (see **Compliance**).
- The name is only as true as the app's claim. Impersonation and inflated lines
  from a modified client cannot be ruled out, only limited (plausibility caps,
  one row per player, a hand-kept hide list; designed in issue 566). That is
  reputational damage, not a data breach, and the page cannot promise a record
  is genuine.
- Anonymous entries publish lines from players who never agreed. Deleting the
  account, or unlinking, removes the name but not the line: the same line can
  then reappear on the kills boards as "Anonymous" until it is purged. Only
  "forget me" (which deletes the lines) or a deletion request removes it. The
  copy says so; if that surprises people, changing it is a decision for the
  maintainer.
- Damage, healing and damage blocked boards publish one uploader's own numbers
  next to their name.
- Figures can be attached to a line by the claimed uid without checking who
  recorded it (`record_match_extras`; issue 352 tracks closing it). Until then
  another uploader could put false damage, healing or blocked figures beside a
  genuine opted-in name. Accepted for the first version.
- The legal basis for showing lines publicly extends the one the desktop app
  policy gives today (decision 3). The maintainer accepts that as a risk, and it
  takes effect once overlay issue 1386 updates section 8 of that policy. On
  2026-11-08 the maintainer accepted shipping before that update (see Status).
- A short cache lifetime (60 seconds) on the records API is a cost in load
  against the site-wide five minutes plus an hour of stale answers, which would
  show a name for about 65 minutes after its owner switched it off.

**What now has to be true**

- No name appears on any page before the policy copy in this change is live.
- Every name on the page comes from a link, an opted-in setting and the two-key
  match; nothing else can produce one.
- `participants` keeps its closed row-level security.
- The records API answers with `s-maxage` of at most 60 seconds and no stale
  window over 60 seconds.
- The privacy page keeps saying that anonymous entries are published lines from
  players who did not consent, that the name is the app's claim, and how to be
  removed.

## Compliance

A reviewer checks a change against this decision by looking for:

- No page, API answer or log that carries a uid, recorder code, line id, email,
  account id or match time for a Pulse Records entry, and no name that did not
  come from a link whose owner switched the setting on.
- A test or a checked script showing that the same uid uploaded by someone else
  is never named, that `do_not_store` entries never appear, and that `anon` and
  `authenticated` cannot read `participants`.
- The setting is a native, labelled checkbox that is off by default and off
  again when the account is deleted, and the account page and `/privacy` match
  this record. `/privacy` says Pulse Records is not open yet until issue 567
  opens it (the status constant in `privacy-notes.data.ts`).
- The desktop app policy conflicts, which this change does not edit, and are
  tracked as issue 1386 in `anthonyturner/rivals_pulse`: sections 1, 3 and 4 say
  scoreboard lines are visible to app users only, section 4 says a player's
  damage, healing and damage blocked are never shown as theirs and that
  published averages "never show one player's numbers", section 2.1 says there
  are no accounts (already tracked there as issue 1168), section 5 (the "Why"
  column of the Supabase row) lists lookups, ban rates and hero averages but not
  a public records page, and sections 7, 8 and 9 do not mention entries on the
  website or a name the player chose to show. The policy change must ship before
  the first name can appear on the live site; issue 568 lists it as a blocker.
  **Superseded on 2026-11-08:** the maintainer decided the switch ships first,
  with the website's `/privacy` section as the notice until issue 1386 ships.
- Any later change to the defaults in decision 4 amends this record and the
  website copy in the same pull request.
