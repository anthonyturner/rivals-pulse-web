# Counter data verification — 2026-08-03

Source of truth verified: `counterPicksByHero` in `scripts/refresh-counter-picks.mjs`
(synced into `data/seeds/heroes.mock.json` and the `hero_list_items` table — all three are in agreement with each other).

Verified against: **rivalsmeta.com per-hero matchup tables** (Season 9, Diamond/GM/Celestial/Eternity/One Above All ranks, daily updated, fetched 2026-08-03). All cited matchups have >1,000 games unless flagged.

Verdict scale, from the perspective of the hero being countered:
- **CONFIRMED** — hero loses to the listed counter by ≥5% (Difference ≤ −5%)
- **WEAK** — loses by 2–5%
- **NEUTRAL** — within ±2%
- **CONTRADICTED** — hero actually *wins* the matchup by >2%

## Headline numbers

Of the 250 counter entries (50 heroes × 5 counters):

| Verdict | Count | Share |
|---|---|---|
| CONFIRMED | 80 | 32% |
| WEAK | 27 | 11% |
| NEUTRAL | 21 | 8% |
| CONTRADICTED | 122 | **49%** |

Nearly half of the listed counters currently *lose* the matchup they're supposed to win, many by 10–25%.

## Root cause

The map is archetype-templated (identical lists repeated per archetype) and encodes an early-season meta:

1. **"Anti-dive" template** (`Namor, Scarlet Witch, Peni Parker, Luna Snow, The Thing/Mantis`) applied to all dive heroes. Only Peni Parker and Mantis still hold. Namor, Scarlet Witch, and Luna Snow now *lose* to dive by +9% to +23% (e.g. Magik beats Namor +22.9%, Black Panther beats Scarlet Witch +22.0%, Spider-Man beats Namor +15.5%).
2. **"Hitscan/tank-breaker" template** (`Wolverine, Hela, Hawkeye, The Punisher`) applied to all Vanguards. Almost fully contradicted — every tank checked (Hulk, Thor, Groot, The Thing, Magneto, Venom, Emma Frost partial exception) beats Wolverine and the hitscans. Groot beats The Punisher by +22.4%; Hulk beats Wolverine by +14.8%.
3. **"Hitscan anti-flyer" template** (`Hela, Hawkeye, Punisher, Black Widow, Namor`) applied to flyers. Fully contradicted — Storm beats all five of her listed counters by +16% to +20%; Human Torch and Iron Man likewise beat all of theirs.
4. **"Dive anti-backline" template** (`Spider-Man, Black Panther, Psylocke, Magik, Hela`) applied to supports/immobile DPS. This is the one template that still checks out.

The actual top statistical counters in Season 9, appearing across almost every hero's worst-matchup list: **Peni Parker, Mantis, Magik, Storm, Daredevil, Black Cat, Ultron, Rocket Raccoon**. Caveat: rivalsmeta's "Difference" is not normalized for overall hero strength — Peni Parker (top-tier, zero losing matchups) and Mantis (60% overall WR) top every list partly because they're simply the strongest heroes right now.

## Roster gaps

- **Cyclops** and **Jubilee** are in the current Season 9 roster on rivalsmeta but are absent from `heroes.mock.json` and the counter map entirely.
- Deadpool is tracked per-role on rivalsmeta (Vanguard/Duelist/Strategist variants); the codebase has a single Deadpool entry (verified against the Duelist page).

## Also affected: `counter-engine.service.ts`

`specificCounterReasons` hardcodes explanations for matchups now contradicted by the data:
- `Spider-Man|Namor` — Spider-Man wins +15.5%
- `Iron Man|Namor` — Iron Man wins +12.8%
- `Black Panther|Namor` — BP wins +16.1%
- `Black Panther|Scarlet Witch` — BP wins +22.0%
- `Venom|Wolverine` — Venom wins +17.6%
- `Hulk|Wolverine` — Hulk wins +14.8%
- `Black Panther|Peni Parker` and `Spider-Man|Namor`'s Peni analogue — Peni entries are the only ones still supported.

The `answerProfiles` map (hitscan = anti-flyer, Wolverine/Punisher/Hela = tank-breaker, Namor/Luna = anti-dive) encodes the same outdated assumptions.

## Per-hero results

Format: expected list verdicts, then the actual top counters (hero's win rate deficit, "Diff").

### Lists that are still accurate (≥4/5 confirmed)
| Hero | Verdicts | Notes |
|---|---|---|
| Invisible Woman | 4 CONFIRMED, 1 WEAK | Actual top: Peni −30.3, Mantis −22.1, Storm −17.1, Magik −15.9 |
| Jeff the Land Shark | 4 CONFIRMED, 1 WEAK (Black Panther −4.9) | Actual top: Peni −36.3, Mantis −24.7, Storm −19.5 |
| Luna Snow | 5 CONFIRMED | Actual top: Peni −35.7, Mantis −25.7, Storm −22.0 |
| Moon Knight | 5 CONFIRMED | Loses nearly every matchup at Diamond+; Peni −46.7, Mantis −37.3, Loki −31.2 |
| Phoenix | 5 CONFIRMED | Actual top: Peni −40.2, Storm −34.4, Mantis −32.3 |
| Squirrel Girl | 5 CONFIRMED | Loses to nearly entire roster; Peni −42.5, Mantis −33.5 |
| The Punisher | 4 CONFIRMED, 1 WEAK | Actual top: Peni −31.5, Mantis −22.7, Groot −22.4 |
| White Fox | 5 CONFIRMED | Actual top: Peni −32.9, Mantis −29.9, Magik −22.2 |

### Fully or almost fully wrong (0 confirmed)
| Hero | Expected (all wrong) | Actual top counters |
|---|---|---|
| Angela | Hela, Hawkeye, Punisher, B.Widow, Namor — all CONTRADICTED (+2.5 to +13.4) | Peni −24.2, Mantis −12.4, Human Torch −10.7, Ultron −9.5, Storm −9.5 |
| Devil Dinosaur | 4 CONTRADICTED, Wolverine WEAK | Peni −25.5, Mantis −19.1, Magik −17.7, Daredevil −14.1 |
| Gambit | 3 WEAK, 1 NEUTRAL, Moon Knight CONTRADICTED (+11.0) | Peni −29.8, Mantis −20.3, Storm −14.6, Magik −13.0 |
| Groot | 4 CONTRADICTED (beats Punisher +22.4, Wolverine +17.3), 1 NEUTRAL | Peni −24.5, Mantis −10.1, Magik −9.5, The Thing −6.7 |
| Hela | 3 CONTRADICTED, 2 NEUTRAL | Peni −25.5, Mantis −16.6, Storm −16.3, Iron Man −13.2 |
| Human Torch | all 5 CONTRADICTED (+3.5 to +17.5) | Peni −28.4, Mantis −13.2, Magik −8.8, Daredevil −6.3 |
| Iron Man | all 5 CONTRADICTED (+7.3 to +18.6) | Peni −29.1, Mantis −12.0, Daredevil −9.7, Magik −6.4 |
| Loki | all 5 CONTRADICTED (beats Moon Knight +31.2) | Peni −25.0, Mantis −12.1, Storm −8.6, Magik −8.1 |
| Magneto | 4 CONTRADICTED, Hela NEUTRAL | Peni −27.9, Mantis −16.4, Storm −11.7, Magik −9.2 |
| Mantis | all 5 CONTRADICTED (+5.5 to +22.2) | Peni −13.9 is the ONLY hero with an edge on Mantis |
| Peni Parker | all 5 CONTRADICTED (+25.5 to +31.9) | Peni has NO losing matchups at Diamond+ (best attempts: Daredevil/Magik still lose ~55/45) |
| Rocket Raccoon | 4 CONTRADICTED, Magik WEAK | Peni −16.4, Mantis −11.2, Daredevil −4.0, Magik −3.7 |
| Star-Lord | 4 CONTRADICTED, Hela NEUTRAL | Peni −29.1, Mantis −13.2, Storm −11.1, Iron Man −10.0 |
| Storm | all 5 CONTRADICTED (+16.3 to +19.8) | Only 5 losing matchups: Peni −15.3, Mantis −5.3, Black Cat −3.6, Daredevil −3.4, Magik −2.3 |

### Partially right (typically only Peni Parker and/or Mantis survive)
| Hero | Confirmed | Contradicted / other |
|---|---|---|
| Adam Warlock | Magik −14.3 | Spider-Man/BP/Hela WEAK, Psylocke NEUTRAL. Actual: Peni −27.3, Mantis −16.8, Daredevil −13.7 |
| Black Cat | Peni −16.6 | Namor +19.5, SW +18.6, Luna +15.0, Thing +9.0. Only other real counter: Mantis −10.3 |
| Black Panther | Peni −16.9 | Namor +16.1, SW +22.0, Luna +5.6, Thing +7.5. Actual: Mantis −22.2, Magik −9.0, Groot −8.3 |
| Black Widow | Magik −14.5 | Spider-Man/Psylocke/Venom WEAK, BP NEUTRAL. Actual: Peni −32.3, Mantis −20.9, Storm −19.4 |
| Blade | Peni −26.9, Thing −7.3, Mantis −16.7 | Luna +7.2, SW +7.4 |
| Hulk | Mantis −14.6 | Wolverine +14.8, Hela +2.8, Hawkeye +6.5, Punisher +10.5. Actual: Peni −24.2, Storm −6.1 |
| Captain America | Hawkeye −5.4, Mantis −17.4 | Wolverine +10.3, Namor +9.1; Hela WEAK. Actual: Peni −28.0, Storm −11.4, Groot −11.1 |
| Cloak & Dagger | Magik −14.8 | 4 WEAK. Actual: Peni −29.7, Mantis −21.1, Storm −15.2 |
| Daredevil | Peni −10.6 | Namor +21.7, SW +20.9, Luna +15.4, Thing +9.4. Only other counter: Mantis −8.6 |
| Deadpool | Peni −29.0, Mantis −22.7, Thing −12.2 | Namor/SW NEUTRAL. Also: Magik −19.6, Storm −19.5 |
| Doctor Strange | Hela −9.4, Hawkeye −6.3, Magneto −6.5 | Wolverine +2.9, Moon Knight +5.2. Actual top: Peni −31.9, Mantis −21.6, Storm −18.7 |
| Elsa Bloodstone | Magik −10.0 | 2 WEAK, 2 NEUTRAL. Actual: Peni −28.9, Mantis −16.2, Storm −10.3 |
| Emma Frost | Wolverine −7.2, Hela −7.1 | Hawkeye WEAK, Punisher/Strange NEUTRAL. Actual: Peni −32.2, Mantis −21.6, Magik −17.8 |
| Hawkeye | Magik −11.6 | BP +2.9, Psylocke +2.6; Venom WEAK. Actual: Peni −30.4, Mantis −21.9, Storm −19.8, Ultron −17.2 |
| Iron Fist | Peni −19.8, Mantis −12.5 | Namor +15.7, SW +16.1, Luna +10.7 |
| Magik | Peni −11.5 | Namor +22.9, SW +23.1, Luna +16.9, Thing +8.0. Only other negative: Mantis −5.5 |
| Mister Fantastic | Peni −20.7, Mantis −12.5 | Wolverine +10.4, Luna +11.5; Thing WEAK. Also: Black Cat −14.2, Magik −12.2 |
| Namor | Hela −5.7 | Hawkeye/Punisher/B.Widow/Strange NEUTRAL. Actual: Peni −29.0, Mantis −25.4, Magik −22.9, Daredevil −21.7 |
| Psylocke | Peni −26.5, Mantis −16.3 | Namor +9.9, SW +8.6, Luna +9.3 |
| Rogue | Mantis −17.8 | Wolverine +8.9, Hawkeye +2.1, Punisher +3.3; Hela WEAK. Actual: Peni −28.1, Storm −14.4, Magik −11.4 |
| Scarlet Witch | Hela −12.2, Hawkeye −6.5 | B.Widow/Strange WEAK, Punisher NEUTRAL. Actual: Peni −28.0, Mantis −26.4, Storm −25.8, Ultron −23.7 |
| Spider-Man | Peni −24.5, Mantis −18.8 | Namor +15.5, SW +17.8, Luna +7.6. Actual: Storm −14.7, Iron Man −13.5, Ultron −12.1 |
| The Thing | Mantis −12.5 | Wolverine +4.3, Hela +7.6, Hawkeye +9.6, Punisher +17.8. Actual: Peni −17.8, Daredevil −9.4, Black Cat −9.0 |
| Thor | Mantis −14.3 | Wolverine +9.4, Hela +3.2, Hawkeye +8.1, Punisher +9.2. Actual: Peni −23.1, Magik −9.6, Storm −7.4 |
| Ultron | Black Panther −6.4 | Spider-Man +12.1, Psylocke +4.6, Hela +10.5; Magik WEAK. Actual: Peni −17.4, Mantis −9.9, Storm −8.7 |
| Venom | Peni −23.1, Mantis −14.9 | Wolverine +17.6, Namor +11.2, SW +14.1. Also: Storm −8.5, Magik −7.7, Groot −7.3 |
| Winter Soldier | Peni −29.2, Mantis −20.2 | Namor +3.2, SW +5.4, Strange +2.9. Also: Magik −15.3, Daredevil −14.7 |
| Wolverine | Peni −29.9, Mantis −20.2 | SW +2.6; Thing WEAK, Luna NEUTRAL. Actual: Venom −17.6, Groot −17.3, Magik −16.4, Hulk −14.8 |

## Interpretation caveats

- Matchup win-rate difference is not a pure "counter" signal: it blends overall hero strength with the matchup effect. Peni Parker and Mantis appear as everyone's top counter partly because they are the strongest heroes in the current patch. A future refresh should consider normalizing the difference by both heroes' overall win rates.
- Data reflects Diamond+ play only; low-rank matchup dynamics differ (e.g. snipers punish flyers more at low ranks).
- Contradictions concentrated on Namor / Scarlet Witch / Luna Snow / Wolverine / hitscans suggest the map was written around the Season 0–2 meta and never refreshed.
