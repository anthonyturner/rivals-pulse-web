# Hero build scores

Damage, Sustain, Ultimate and Utility each get a 1 to 10 score per hero, worked
out from what RivalsPulse overlay users actually did, in Quick Match and
Competitive. Mobility is the fifth signal and comes from the hero's kit instead;
see [hero-kit-mobility.md](hero-kit-mobility.md).

The team builder and the hero pages show them; a hero without a score says why and
how far along it is, and is never given a guess. A team's signal is the average out
of 10 across the chosen heroes with a number for it, and says how many of the six
it uses. The display is in
[hero-build-signals.ts](../src/app/features/heroes/hero-build-signals/hero-build-signals.ts).
Nothing here reaches the game: the overlay has no reader for this data. The
decision behind collecting and publishing them is the overlay repository's
ADR-0021.

The wiki-based guesses these replace are gone. Stored hero rows may still hold the
old `buildProfile` and `buildProfileRationale` until their next save, so the hero
store drops both on every read, and neither `/api/heroes` nor Pulse Atlas publishes
them. The overlay's hero lookup hides its Combat Profile panel for a hero without a
`buildProfile`.

- **Code:** [hero-scores.ts](../src/server/community/extended/hero-scores.ts).
- **Tags:** [hero-ability-tags.table.json](../src/server/community/extended/hero-ability-tags.table.json),
  written by [build-hero-ability-tags.mjs](../scripts/build-hero-ability-tags.mjs).
- **Read through:** `GET /api/community/hero-scores` and, for tools,
  `hero-scores.json` in [Pulse Atlas](pulse-atlas.md).

## How each score is worked out

| Stat | Label | What is ranked |
| --- | --- | --- |
| Damage | Measured | Damage per minute. |
| Sustain | Measured | Healing per minute plus damage blocked per minute. |
| Ultimate | Estimated | Ultimates per 10 minutes, and kills plus assists per ultimate within 10 seconds. |
| Utility | Estimated | How much of what its cooldown allowed the hero used its Utility abilities, and kills plus assists per use within 5 seconds. |

Utility and Ultimate stay estimates because the game shows that an ability was
used, not whether it landed.

**Ranking.** Each measure is ranked across every hero that passes the rule. A
hero's place runs from 0 (lowest) to 1 (highest), and tied heroes share their
middle place. A score is `1 + round(place * 9)`. The score says where a hero sits
among today's qualifying heroes, so it can move as others join.

## The weights

Refinement never ran on this work, so these are the simplest defensible values.
They are one constant each, `HERO_SCORE_WEIGHTS` in
[hero-scores.ts](../src/server/community/extended/hero-scores.ts), and are easy to
change.

- **Ultimate and Utility are half and half.** How often it was used, and what
  followed. Neither has evidence that it matters more. The two are ranked
  separately, weighted, then ranked again, so that a big number in one unit cannot
  swamp the other and the scores still reach both ends of the scale.
- **Healing and damage blocked count the same.** A simple sum, as the issue asks.
- **A kill and an assist count the same.** The feed cannot say which mattered more.

## Who gets a score

During solo testing, `read_community_hero_scores` allows 10 or more lines from one player, including when that player supplied every line. This temporary exception applies only to build signals and their ability figures; other community readers still use the shared rule below. Figures can therefore describe a single tester and are not representative community benchmarks. To restore the shared rule, add a new migration restoring this reader from `20261104130000_hero_score_read.sql` and set `HERO_SCORE_MINIMUMS` back to 2 contributors and a share of 1.

The shared rule is `hero_figure_qualifies` in the database: 10 or more lines (one player
on one hero in one match), 2 or more players, and no cap on one player's share (`community_max_recorder_share_percent()` is 100). It is applied
per half-season and per mode, before anything is added up, and on each input on
its own.

- **Below the rule there is no score, and never a guess.** The stat's `status` is
  `collecting`, and `matches`, `contributors` and `oneContributorAboveHalf` say how
  far along it is. Because the rule is per mode, these show the closest single mode;
  6 lines in Quick Match and 8 in Competitive reads as the 8.
- **Progress counts matches in steps of 5.** 8 lines reads as 5, so a display says
  "5 of 10". With one contributor an exact count is one person's own games on that
  hero, and comparing two publishes would show when they played. ADR-0021 promises
  never one player's numbers.
- **A hero the game splits by role passes per form too.** Deadpool's role ids each
  pass the rule on their own before they are added together.
- **A hero with no line at all in the half-season has no entry.** That reads as
  0 of each minimum.
- **Each stat stands alone.** A hero can have a Damage score and be collecting for
  Ultimate.
- **All of a stat's inputs must pass.** If damage blocked is held back, Sustain
  waits, because leaving it out would understate the hero. An input with no lines
  at all, such as a figure the feed never sent for this hero, is left out rather
  than counted as 0.
- **A ranking needs 5 qualifying heroes.** Below that the status is
  `ranking-too-small`: the hero's figures are shown, with no score. A ranking of two
  heroes would call one of them 10 and the other 1. This number is `rankedHeroes` in
  `HERO_SCORE_MINIMUMS`.
- **A hero with nothing to measure says so.** A hero with no ability that is tagged
  Utility and prints a plain cooldown has the status `no-measurable-ability`, which
  is not the same as scoring low.

The half-season shown is the current one, or the previous one while the current one
has no score, named in `inPlaceOf`. `?halfSeason=` asks for an exact one.

## Ability tags

Each of the official pages' abilities has one row: `Utility`, `Damage`, `Mobility`,
`Sustain`, or no tag. A row with a tag has its evidence, the source, the field and
the text; a row with none has the reason. The spec checks that every piece of
evidence really is in that source.

The rules run in this order, and stop at the first that decides:

1. **The hero kit mobility table lists it:** Mobility.
2. **It is a normal attack:** Damage.
3. **The one-line description names an effect:** that tag, when it names exactly
   one. Naming two is undecided, and any mention of damage done to someone counts as
   naming Damage. The description is the page's own statement of what the ability is
   for, so a number in a detail row does not outvote it. An ability whose description
   names only a stun or a slow, and which also prints a little damage, is therefore
   Utility. This is the judgement most worth a reviewer's eye.
4. **The detail rows name one effect:** that tag.
5. **Otherwise:** no tag.

The words that count are at the top of the script. Delivery words such as "launch"
and "fire" do not count, because they say how an ability travels, not what it does.

An untagged ability never counts toward Utility. The full list is
[hero-ability-untagged.md](hero-ability-untagged.md). To settle one, improve the rule
or the source and rerun the script. Hand edits to the table are lost on the next run.

### From a key to a slot

The upload counts by slot, and a slot follows a key: `ability_0` Right Click,
`ability_1` Shift, `ability_2` E, `ability_3` F, `team_up_0` C, and `ultimate` Q,
from the overlay's logged matches. Those logs cover about eight heroes, and the
mapping is applied to all of them. `ability_4` and `team_up_1` are not established,
so nothing maps to them.

- **A slot the hero's page does not list is ignored.** The overlay sends every slot,
  at 0 when unused, so this is what stops a hero's empty slots counting.
- **A slot with several abilities is only as certain as all of them.** A team-up, a
  form or an upgrade can share a key, and a count cannot say which one it was. The
  slot has a tag only if they all agree, and a cooldown only if they all print the
  same one. Most team-up slots stay untagged for this reason.
- **Utility counts a slot only with a plain cooldown.** Without one there is no way
  to say how often it was available. A printed cooldown such as "3s after it breaks"
  does not count. Use above 100% of the cooldown is capped, as cooldown cuts allow it.
  A team-up on a shared key is taken as available for all time played, which it may
  not be.

## Known limits

- **The tags come from a saved copy of the official pages.**
  `data/turso-cutover/106` was compared with the live pages on 2026-11-04. Rerun the
  script after a balance patch.
- **The counts themselves are estimates.** Overlay issue 1320 covers two ways they
  could be wrong on heroes not yet seen in logs: a partial cooldown cut read as a use,
  and a dip before an ultimate that is lost.
- **The rule counts lines, and a rate reads the lines that carry its figure.** Uses
  per ten minutes reads lines with a time played, and takedowns the lines that carry
  them. With today's overlay these are the same lines. If they ever differ, a passing
  row's rate could rest on fewer players than the rule counted.
- **Most heroes cannot get a Utility score yet.** Today only those with a Utility
  ability on its own key and a plain cooldown can.
- **Nothing has been scored from real data.** No release of the overlay has sent
  ability counts yet, so Ultimate and Utility have run only on test data.
