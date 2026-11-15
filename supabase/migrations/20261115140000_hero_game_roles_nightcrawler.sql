-- Gives Nightcrawler's game hero id a role (issue 857), so his matches count in the triple-support
-- aggregates. The game sends him as character id 1068; data/pulse-atlas/hero-game-ids.json now maps it,
-- and `scripts/hero-game-roles-seed.test.ts` compares that file with the rows the migrations insert.
-- Additive only: one row in `hero_game_roles`, no table or function is touched. Until the row exists, a
-- team with a Nightcrawler is counted as unclassified; the hourly rebuild picks the row up on its next run.

insert into public.hero_game_roles (game_id, base_game_id, role) values
  (1068, 1068, 'Strategist') -- nightcrawler
on conflict (game_id) do update
  set base_game_id = excluded.base_game_id,
      role = excluded.role;
