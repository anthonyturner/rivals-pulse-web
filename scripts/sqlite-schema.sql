PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS home_portals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  path TEXT NOT NULL,
  image TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  raw_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS home_content_blocks (
  content_key TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS external_sources (
  source_key TEXT PRIMARY KEY,
  source_name TEXT NOT NULL,
  url TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  status TEXT NOT NULL,
  error TEXT
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_key TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS tier_list_seasons (
  source_season_id INTEGER PRIMARY KEY,
  season_number INTEGER NOT NULL,
  half INTEGER NOT NULL,
  sub_season TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  half_name TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  source_timestamp INTEGER,
  raw_stats_json TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tier_list_rank_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id INTEGER NOT NULL REFERENCES tier_list_seasons(source_season_id) ON DELETE CASCADE,
  rank_filter TEXT NOT NULL,
  rank_label TEXT NOT NULL,
  source_url TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (season_id, rank_filter)
);

CREATE TABLE IF NOT EXISTS tier_list_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id INTEGER NOT NULL REFERENCES tier_list_seasons(source_season_id) ON DELETE CASCADE,
  rank_filter TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('S', 'A', 'B', 'C', 'D', 'F')),
  hero_id INTEGER NOT NULL,
  hero_name TEXT NOT NULL,
  role TEXT NOT NULL,
  image_url TEXT NOT NULL,
  win_rate REAL NOT NULL,
  pick_rate REAL NOT NULL,
  ban_rate REAL NOT NULL,
  matches INTEGER NOT NULL,
  wins INTEGER NOT NULL,
  score INTEGER NOT NULL,
  sort_order INTEGER NOT NULL,
  raw_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS game_stat_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  capture_bucket TEXT NOT NULL UNIQUE,
  snapshot_date TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  current_player_source TEXT NOT NULL,
  current_player_source_url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS game_stat_snapshot_games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_id INTEGER NOT NULL REFERENCES game_stat_snapshots(id) ON DELETE CASCADE,
  app_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  current_players INTEGER NOT NULL,
  daily_peak INTEGER NOT NULL,
  all_time_peak INTEGER NOT NULL,
  steam_daily_rank TEXT NOT NULL,
  top_seller_rank TEXT NOT NULL,
  twitch_viewers INTEGER NOT NULL,
  review_summary TEXT NOT NULL,
  source_url TEXT NOT NULL,
  UNIQUE (snapshot_id, app_id)
);

CREATE INDEX IF NOT EXISTS idx_home_portals_sort_order ON home_portals(sort_order);
CREATE INDEX IF NOT EXISTS idx_sync_runs_source_key ON sync_runs(source_key);
CREATE INDEX IF NOT EXISTS idx_tier_list_rank_snapshots_season ON tier_list_rank_snapshots(season_id);
CREATE INDEX IF NOT EXISTS idx_tier_list_items_lookup ON tier_list_items(season_id, rank_filter, tier, sort_order);
CREATE INDEX IF NOT EXISTS idx_tier_list_items_hero ON tier_list_items(hero_id);
CREATE INDEX IF NOT EXISTS idx_game_stat_snapshots_captured_at ON game_stat_snapshots(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_stat_snapshot_games_app ON game_stat_snapshot_games(app_id, snapshot_id);
