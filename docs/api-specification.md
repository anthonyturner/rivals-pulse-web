# API Specification

GET /api/heroes
GET /api/heroes/{id}
GET /api/meta
GET /api/hero-stats
GET /api/community/insights
GET /api/community/figures
GET /api/community/kills
GET /api/hero-matchups
POST /api/coach/analyze

Static reference data for other tools is published separately as Pulse Atlas; see [pulse-atlas.md](pulse-atlas.md).

`/api/hero-stats` serves the hero numbers derived from Rivals Pulse overlay matches, and `/api/hero-matchups` how each hero fares against each enemy hero in those matches (the only source of counter data); see "Reading the hero aggregates" in [supabase.md](supabase.md).

`/api/community/insights` serves when the community plays and wins (weekday, time of day in UTC, place in a play session), before the aggregates exist it answers 200 with `status: "not-enough-data"`; any other failure keeps its error status. See "Play-time aggregates" in [supabase.md](supabase.md).
`/api/hero-stats` takes two optional query values: `halfSeason` (an exact half-season such as `10.5`) and `mode` (`quick-match`, `competitive`, `arcade`, `practice` or `all`, the default Quick Match and Competitive blend). Every answer carries `mode` and the `modes` on offer.

`/api/community/stats` serves the Community Stats tab's role benchmarks (average K/D/A, KDA, final hits and win rate per role and mode) from the same matches; see "Role benchmarks" in [supabase.md](supabase.md). It takes the same optional `halfSeason` query value.

`/api/community/figures` serves damage, healing and damage blocked per minute per role and per hero, and `/api/community/kills` the kill-feed counters (which heroes a hero is seen killing most, and is seen killed by most), from the extended upload. Only buckets with at least 3 distinct recorders and no recorder above 50% are returned, rates are whole numbers and kill counts are volume bands, and until the migration is applied or enough matches carry the fields they answer 200 with `status: "not-enough-data"`; any other failure keeps its error status. Both take the optional `halfSeason` query value. See "Extended aggregates: the recorder gate" in [supabase.md](supabase.md).
