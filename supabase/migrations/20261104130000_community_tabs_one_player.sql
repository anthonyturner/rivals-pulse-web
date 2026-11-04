-- Issue 449: the Community Matches and Insights tabs may show figures recorded by one player. The
-- site has effectively one uploader, and the tabs could never fill behind a gate of 3 recorders.
--
-- The sample-size minimums stay. `recorders` and `top_recorder_matches` are still stored, so raising
-- the two numbers below brings the gate back for both tabs with no rebuild. Raise them before other
-- players are invited: with these values a bucket can be one person's play diary.
--
-- `community_bucket_shown` is deliberately left alone: it also gates the hero pair rank bands.

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

-- The Matches tab's bucket gate, on the same two numbers the Insights read applies.
create or replace function public.community_tab_bucket_shown(
  p_matches integer,
  p_recorders integer,
  p_top_recorder_matches integer
) returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_recorders >= public.insights_min_recorders()
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
  assert public.community_tab_bucket_shown(10, 1, 10), 'one recorder must be shown on the tabs';
  assert not public.community_bucket_shown(10, 1, 10), 'the hero pair gate must still hide one recorder';
end
$$;

revoke execute on function public.community_tab_bucket_shown(integer, integer, integer) from public, anon, authenticated;
grant execute on function public.community_tab_bucket_shown(integer, integer, integer) to service_role;
