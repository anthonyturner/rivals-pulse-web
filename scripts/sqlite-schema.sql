PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_key TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT
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

CREATE INDEX IF NOT EXISTS idx_sync_runs_source_key ON sync_runs(source_key);
CREATE INDEX IF NOT EXISTS idx_game_stat_snapshots_captured_at ON game_stat_snapshots(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_stat_snapshot_games_app ON game_stat_snapshot_games(app_id, snapshot_id);
