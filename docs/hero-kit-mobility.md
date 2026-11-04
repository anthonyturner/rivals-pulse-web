# Hero kit Mobility

Mobility is the one build signal that cannot be measured from matches, because
the game feed has no position or movement data. It is a fixed value worked out
from each hero's published kit, and it is labelled Hero kit.

The table is [hero-kit-mobility.table.json](../src/app/features/heroes/hero-kit-mobility.table.json)
and the formula is [hero-kit-mobility.ts](../src/app/features/heroes/hero-kit-mobility.ts).

## The website does not use this yet

`publishableHeroKitMobilityScores()` returns nothing until every hero can be
scored, so the site keeps today's hand-set Mobility values until then. Mixing
the two scales would put heroes side by side on numbers that mean different
things.

## Rules for the table

- **Never guess.** A value the source does not print stays `null`. Do not work
  one out from other figures: speed times duration gives a ceiling, not a
  distance.
- **Record the source.** Every value keeps the text as printed (`raw`), where it
  is printed (`field`) and which source it came from (`source`). The spec checks
  official values against the saved copy of the official pages, so a typo fails
  the tests.
- **Only the hero's own movement.** Projectile speed, attack range and boosts
  given to allies do not count, and the spec rejects them. A hook's speed and
  length describe the hook, not the hero.
- **Only the hero's regular kit.** Ultimates, team-up abilities and normal
  attacks are left out. A hero's `excluded` list names any other ability left out
  and why, such as one bought with a resource or one that only moves the hero
  when a target is marked. Abilities that need a setup the hero makes in normal
  play, such as Loki's swap with his illusion, stay in.

### Sources

The official hero pages come first. They are read by the repository's own
scraper, `scripts/official-heroes-source.mjs`. The rest of the table's sources
are listed in its `sources` block.

- **A speed of `600`.** Eleven kit pages print base speed as a bare `600` with no
  unit. The Version 20250411 balance post raises Hulk and Thor "from 600 to 650",
  and their kit pages list 6.5 m/s, so `600` is 6 m/s. Those rows carry that post
  in `unitSource`.
- **Storm's flight.** Her official page does not state it, so it comes from the
  wiki text in `data/seeds/heroes.mock.json`. It is the only value in the table
  from a secondary source.
- **Labels that are wrong on the official page.** Several pages list a distance
  under "Dash Duration", such as `8m`. The value is kept with its printed label
  and a note, because the unit shows what it is.

## The formula

```text
score = 1 + base + burst + sustained + flight + jumps, rounded, from 1 to 10
```

| Part | Worked out as | Most points |
| --- | --- | --- |
| Base | 2 per m/s of base speed above the normal 6 m/s | no cap |
| Burst | Metres per second of cooldown, added across dashes, leaps and teleports | 4 |
| Sustained | (Fastest flight, glide, wall-run or speed boost, minus base speed) divided by 3 | 3 |
| Flight | 3 if flying is how the hero normally moves, 1 if an ability flies | 3 |
| Jumps | 0.25 per extra jump | no cap |

Why it has this shape:

- **Burst uses distance over cooldown** because that is how much ground the
  abilities cover over time. A charge's recharge time stands in for the cooldown.
- **Burst is capped** because a short cooldown would otherwise decide the whole
  score. Cyber-Bond alone would reach 10 points.
- **Sustained uses only the fastest option** because a hero moves one way at a
  time. How long it can be kept up is not counted, because several kits publish
  an energy cost rather than a duration.
- **Flight is scored apart from speed.** Iron Man and Storm move at a normal
  speed and have few dashes, so a speed-only formula would rank them too low.
- **Extra jumps count a flat amount** because the kit pages print no height for
  them, and they do help.

These weights are a judgement call, made to be simple and to read sensibly
against the game. The numbers they use are sourced; the weights are not. Change
them here and in the code together.

### What a hero needs before they get a score

| Kind | Needs |
| --- | --- |
| Every hero | Base speed |
| `burst` | Distance and cooldown. Speed is recorded where published, but not scored. |
| `sustained` | Speed. Cooldown is recorded where published, but not scored. |
| `extra-jump` | Nothing |

## What is still missing

`heroKitMobilityCoverage()` gives the live count. As of 2026-11-04, 41 of 54
heroes can be scored. These 13 cannot, because neither the official pages nor
the public sources checked print the value:

| Hero | Missing |
| --- | --- |
| Angela | Wingblade Ascent: cooldown |
| Black Cat | Stealthy Catwalk: speed |
| Black Widow | Widow's Bite Slam: distance |
| Blade | Daywalker Dash: cooldown |
| Devil Dinosaur | Savage Predation: distance |
| Elsa Bloodstone | Ruthless Pursuit: distance; Helix Advance: distance |
| Hulk | Incredible Leap: distance and cooldown |
| Human Torch | Flaming Meteor: distance |
| Moon Knight | Moonlight Hook: distance |
| Rogue | Chrono Kick Combo: speed |
| Star-Lord | Stellar Shift: distance |
| Thor | Storm Surge: cooldown |
| Wolverine | Feral Leap: distance |

Moon Knight's page does give a "Maximum Distance", but as `21.5m/s`, which is a
speed unit, so it was not used. Thor's page gives a Thorforce cost rather than a
cooldown.

Measuring them in the game's practice range is the likely way to fill these.
Record such a value with its own entry in `sources`, saying who measured it, how
and on which game version.
