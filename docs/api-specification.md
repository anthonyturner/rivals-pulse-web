# API Specification

GET /api/heroes
GET /api/heroes/{id}
GET /api/meta
GET /api/hero-stats
GET /api/hero-matchups
POST /api/coach/analyze

Static reference data for other tools is published separately as Pulse Atlas; see [pulse-atlas.md](pulse-atlas.md).

`/api/hero-stats` serves the hero numbers derived from Rivals Pulse overlay matches, and `/api/hero-matchups` how each hero fares against each enemy hero in those matches (the only source of counter data); see "Reading the hero aggregates" in [supabase.md](supabase.md).
