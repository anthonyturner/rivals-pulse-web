-- Issue 616: the busiest-player flags of the hero build scores follow the published limit on the busiest
-- player, `public.community_max_recorder_share_percent()`, instead of a fixed half. They were
-- `top_recorder_n * 2 > n`; they are now `top_recorder_n * 100 > n * community_max_recorder_share_percent()`,
-- so they are false while the limit is 100 (no limit) and name the busiest player only when they exceed
-- the limit the site publishes. The JSON keys keep their names (`*_busiest_above_half`) so the website
-- and the Pulse Atlas read the same answer; they now mean "above the published share".
--
-- Only this reader is restated, with the same signature, security, search path and grants. What
-- qualifies (10 lines, 1 recorder: the solo-testing exception of 20261106170000) is unchanged.
--
-- Pushing this migration is a separate step from merging the pull request: run `supabase db push`
-- after the merge.

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
               'damage_busiest_above_half', a.damage_top_recorder_n * 100 > a.damage_n * public.community_max_recorder_share_percent(),
               'damage_qualifies', s.damage,
               'damage_sum', case when s.damage then a.damage_sum else 0 end,
               'damage_seconds', case when s.damage then a.damage_seconds else 0 end,
               'healing_n', a.healing_n,
               'healing_recorders', a.healing_recorders,
               'healing_busiest_above_half', a.healing_top_recorder_n * 100 > a.healing_n * public.community_max_recorder_share_percent(),
               'healing_qualifies', s.healing,
               'healing_sum', case when s.healing then a.healing_sum else 0 end,
               'healing_seconds', case when s.healing then a.healing_seconds else 0 end,
               'blocked_n', a.blocked_n,
               'blocked_recorders', a.blocked_recorders,
               'blocked_busiest_above_half', a.blocked_top_recorder_n * 100 > a.blocked_n * public.community_max_recorder_share_percent(),
               'blocked_qualifies', s.blocked,
               'blocked_sum', case when s.blocked then a.blocked_sum else 0 end,
               'blocked_seconds', case when s.blocked then a.blocked_seconds else 0 end)
             order by a.half_season, a.play_mode_id, a.hero_id)
      from public.hero_figure_aggregates a
      cross join lateral (
        select (a.damage_n >= 10 and a.damage_recorders >= 1) as damage,
               (a.healing_n >= 10 and a.healing_recorders >= 1) as healing,
               (a.blocked_n >= 10 and a.blocked_recorders >= 1) as blocked
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
               'busiest_above_half', u.top_recorder_segments * 100 > u.segments * public.community_max_recorder_share_percent(),
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
        select (u.segments >= 10 and u.recorders >= 1) as ok
      ) s
    ), '[]'::jsonb)
  )
$$;

revoke execute on function public.read_community_hero_scores() from public, anon, authenticated;
grant execute on function public.read_community_hero_scores() to service_role;

-- The flag expression is exercised against the live limit, so a wrong comparison fails the push
-- rather than naming a player who is within the limit.
do $$
declare
  share constant integer := public.community_max_recorder_share_percent();
begin
  assert (10 * 100 > 10 * share) = (share < 100), 'a player supplying every match is above the limit only when there is one';
  assert (6 * 100 > 10 * share) = (share < 60), 'a player with 6 of 10 matches is above the limit only under 60%';
  assert (5 * 100 > 10 * share) = (share < 50), 'a player with half the matches is above the limit only under 50%';
end
$$;
