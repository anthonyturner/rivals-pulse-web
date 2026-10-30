# API Specification

GET /api/heroes
GET /api/heroes/{id}
GET /api/heroes/{id}/counters
GET /api/meta
GET /api/hero-stats
GET /api/community/insights
POST /api/coach/analyze

Static reference data for other tools is published separately as Pulse Atlas; see [pulse-atlas.md](pulse-atlas.md).

`/api/hero-stats` serves the hero numbers derived from Rivals Pulse overlay matches; see "Reading the hero aggregates" in [supabase.md](supabase.md).

`/api/community/insights` serves when the community plays and wins (weekday, time of day in UTC, place in a play session), always 200: before the aggregates exist it answers `status: "not-enough-data"`. See "Play-time aggregates" in [supabase.md](supabase.md).
