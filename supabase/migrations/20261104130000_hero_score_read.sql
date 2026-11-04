-- Issue 458: the one way the website reads what the 1 to 10 hero build scores are worked out from.
--
-- Additive: one new function and nothing else. No table, column or existing function changes.

-- Every hero's figures and ability counts per half-season and mode. Its answer is what lets a hero
-- below the rule say how far along it is, so it differs from `read_community_hero_figures` in one way:
-- a row that fails `hero_figure_qualifies` is still sent, with its line and player counts, and with
-- every sum at 0. A row's numbers leave only when that row passes, checked before any modes are summed.
-- Numbers only: no uid, name or per-player row. The busiest player's own count stays here too; only
-- whether it is above half is sent.
create or replace function public.read_community_hero_scores() returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'half_seasons', coalesce((
      select jsonb_agg(jsonb_build_object('half_season', h.half_season, 'starts_at', h.starts_at)
                       order by h.half_season)
      from public.half_seasons h
    ), '[]'::jsonb),
    'figures', coalesce((
      select jsonb_agg(jsonb_build_object(
               'half_season', a.half_season,
               'play_mode_id', a.play_mode_id,
               'hero_id', a.hero_id,
               'damage_n', a.damage_n,
               'damage_recorders', a.damage_recorders,
               'damage_busiest_above_half', a.damage_top_recorder_n * 2 > a.damage_n,
               'damage_qualifies', s.damage,
               'damage_sum', case when s.damage then a.damage_sum else 0 end,
               'damage_seconds', case when s.damage then a.damage_seconds else 0 end,
               'healing_n', a.healing_n,
               'healing_recorders', a.healing_recorders,
               'healing_busiest_above_half', a.healing_top_recorder_n * 2 > a.healing_n,
               'healing_qualifies', s.healing,
               'healing_sum', case when s.healing then a.healing_sum else 0 end,
               'healing_seconds', case when s.healing then a.healing_seconds else 0 end,
               'blocked_n', a.blocked_n,
               'blocked_recorders', a.blocked_recorders,
               'blocked_busiest_above_half', a.blocked_top_recorder_n * 2 > a.blocked_n,
               'blocked_qualifies', s.blocked,
               'blocked_sum', case when s.blocked then a.blocked_sum else 0 end,
               'blocked_seconds', case when s.blocked then a.blocked_seconds else 0 end)
             order by a.half_season, a.play_mode_id, a.hero_id)
      from public.hero_figure_aggregates a
      cross join lateral (
        select public.hero_figure_qualifies(a.damage_n, a.damage_recorders, a.damage_top_recorder_n) as damage,
               public.hero_figure_qualifies(a.healing_n, a.healing_recorders, a.healing_top_recorder_n) as healing,
               public.hero_figure_qualifies(a.blocked_n, a.blocked_recorders, a.blocked_top_recorder_n) as blocked
      ) s
    ), '[]'::jsonb),
    'abilities', coalesce((
      select jsonb_agg(jsonb_build_object(
               'half_season', u.half_season,
               'play_mode_id', u.play_mode_id,
               'hero_id', u.hero_id,
               'slot', u.slot,
               'segments', u.segments,
               'recorders', u.recorders,
               'busiest_above_half', u.top_recorder_segments * 2 > u.segments,
               'qualifies', s.ok,
               'uses_sum', case when s.ok then u.uses_sum else 0 end,
               'uses_timed_sum', case when s.ok then u.uses_timed_sum else 0 end,
               'seconds_sum', case when s.ok then u.seconds_sum else 0 end,
               'kills_after_sum', case when s.ok then u.kills_after_sum else 0 end,
               'kills_after_n', case when s.ok then u.kills_after_n else 0 end,
               'assists_after_sum', case when s.ok then u.assists_after_sum else 0 end,
               'assists_after_n', case when s.ok then u.assists_after_n else 0 end)
             order by u.half_season, u.play_mode_id, u.hero_id, u.slot)
      from public.hero_ability_aggregates u
      cross join lateral (
        select public.hero_figure_qualifies(u.segments, u.recorders, u.top_recorder_segments) as ok
      ) s
    ), '[]'::jsonb)
  )
$$;

-- Postgres grants EXECUTE to everyone on a new function; this is for the web server and nobody else,
-- the publishable key included.
revoke execute on function public.read_community_hero_scores() from public, anon, authenticated;
grant execute on function public.read_community_hero_scores() to service_role;
