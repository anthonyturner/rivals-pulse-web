-- Issue 449: the Community Matches and Insights tabs show a figure once 10 matches back it, from any
-- number of players. Almost every upload still comes from one player, so a figure can be one person's
-- play. Their names and ids stay out, and a day with few matches stays hidden.
--
-- `recorders` and `top_recorder_matches` are still stored. Raising the two player numbers below
-- brings the gate back for both tabs with no rebuild; the rule runs when the numbers are read, so it
-- also applies to half-seasons that are already frozen.
--
-- `community_bucket_shown` is left alone: it also gates the hero pair rank bands.

create or replace function public.insights_min_matches() returns integer
language sql
immutable
set search_path = ''
as $$ select 10 $$;

create or replace function public.insights_min_recorders() returns integer
language sql
immutable
set search_path = ''
as $$ select 1 $$;

create or replace function public.insights_max_recorder_share_percent() returns integer
language sql
immutable
set search_path = ''
as $$ select 100 $$;

-- The Matches tab's bucket gate, on the same three numbers the Insights read applies.
create or replace function public.community_tab_bucket_shown(
  p_matches integer,
  p_recorders integer,
  p_top_recorder_matches integer
) returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_matches >= public.insights_min_matches()
     and p_recorders >= public.insights_min_recorders()
     and p_top_recorder_matches * 100 <= p_matches * public.insights_max_recorder_share_percent()
$$;

create or replace function public.read_community_matches() returns jsonb
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
    'modes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'half_season', a.half_season,
               'play_mode_id', a.play_mode_id,
               'matches', a.matches,
               'duration_sum_seconds', a.duration_sum_seconds,
               'duration_n', a.duration_n)
             order by a.half_season, a.play_mode_id)
      from public.community_mode_aggregates a
      where public.community_tab_bucket_shown(a.matches, a.recorders, a.top_recorder_matches)
    ), '[]'::jsonb),
    'maps', coalesce((
      select jsonb_agg(jsonb_build_object(
               'half_season', a.half_season,
               'play_mode_id', a.play_mode_id,
               'map_name', a.map_name,
               'matches', a.matches,
               'decided_matches', a.decided_matches,
               'wins', a.wins)
             order by a.half_season, a.play_mode_id, a.map_name)
      from public.community_map_aggregates a
      where public.community_tab_bucket_shown(a.matches, a.recorders, a.top_recorder_matches)
    ), '[]'::jsonb),
    'days', coalesce((
      select jsonb_agg(jsonb_build_object(
               'half_season', a.half_season,
               'day', a.day,
               'matches', a.matches)
             order by a.half_season, a.day)
      from public.community_day_aggregates a
      where public.community_tab_bucket_shown(a.matches, a.recorders, a.top_recorder_matches)
    ), '[]'::jsonb)
  )
$$;

do $$
begin
  assert public.community_tab_bucket_shown(10, 1, 10), 'one player with 10 matches must be shown on the tabs';
  assert not public.community_tab_bucket_shown(9, 3, 3), 'fewer than 10 matches must stay hidden on the tabs';
  assert not public.community_bucket_shown(10, 1, 10), 'the hero pair gate must still hide one player';
end
$$;

revoke execute on function public.community_tab_bucket_shown(integer, integer, integer) from public, anon, authenticated;
grant execute on function public.community_tab_bucket_shown(integer, integer, integer) to service_role;
revoke execute on function public.insights_min_matches() from public, anon, authenticated;
grant execute on function public.insights_min_matches() to service_role;
revoke execute on function public.insights_min_recorders() from public, anon, authenticated;
grant execute on function public.insights_min_recorders() to service_role;
revoke execute on function public.insights_max_recorder_share_percent() from public, anon, authenticated;
grant execute on function public.insights_max_recorder_share_percent() to service_role;
revoke execute on function public.read_community_matches() from public, anon, authenticated;
grant execute on function public.read_community_matches() to service_role;
