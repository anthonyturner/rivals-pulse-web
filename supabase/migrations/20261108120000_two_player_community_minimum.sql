-- Issue 603: a stat gated on who recorded it is published once 2 players back it, down from 3, and
-- with no limit on how much of it one of them supplied. The owner tests with two accounts, a main and
-- an alternate, so nothing gated on 3 players, or on nobody above half, could ever show.
--
-- Two rules count players, and both are restated here with the same signature and the same
-- grants: `hero_figure_qualifies` (hero figures and kill pairs) and `community_bucket_shown` (the
-- hero pair, triple support and team line-up rank bands). Both now need 2 players and read the
-- busiest player's limit from `community_max_recorder_share_percent()`, the one number to raise later.
-- The 10-match minimum is as it was. Both rules run when the numbers are read, so nothing is
-- rebuilt, and half-seasons that are already frozen are covered too.
--
-- The website prints the player minimum in `COMMUNITY_FIGURES_MINIMUMS` and `COMMUNITY_KILLS_MINIMUMS`
-- (src/server/community/extended), which a test compares with this file. Pushing this migration is a
-- separate step from merging the pull request: run `supabase db push` after the merge.

-- The most that the busiest recorder may supply of a figure, as a percentage of its matches. 100 is
-- no limit; the starting rule was 50. Raise or lower it here by restating this one function. It is
-- kept apart from `insights_max_recorder_share_percent()` so the hero figures and the Matches and
-- Insights tabs can be tightened separately.
create or replace function public.community_max_recorder_share_percent() returns integer
language sql
immutable
set search_path = ''
as $$ select 100 $$;

create or replace function public.hero_figure_qualifies(
  p_matches integer,
  p_recorders integer,
  p_top_recorder_matches integer
) returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_matches >= 10
     and p_recorders >= 2
     and p_top_recorder_matches * 100 <= p_matches * public.community_max_recorder_share_percent()
$$;

create or replace function public.community_bucket_shown(
  p_matches integer,
  p_recorders integer,
  p_top_recorder_matches integer
) returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_recorders >= 2
     and p_top_recorder_matches * 100 <= p_matches * public.community_max_recorder_share_percent()
$$;

-- A wrong rule fails the push rather than publishing someone's numbers.
do $$
begin
  assert public.community_max_recorder_share_percent() = 100, 'the busiest player is not limited';

  assert public.hero_figure_qualifies(10, 2, 6), 'two players qualify however the matches are split';
  assert public.hero_figure_qualifies(10, 2, 10), 'a figure one of two players supplies whole qualifies under the 100% share';
  assert public.hero_figure_qualifies(20, 4, 4), 'a spread figure must qualify';
  assert not public.hero_figure_qualifies(9, 2, 4), 'too few matches must be hidden';
  assert not public.hero_figure_qualifies(10, 1, 5), 'one player must be hidden';
  assert not public.hero_figure_qualifies(0, 0, 0), 'a row with no counts must be hidden';

  assert public.community_bucket_shown(10, 2, 6), 'two players are shown however the matches are split';
  assert public.community_bucket_shown(20, 4, 4), 'a spread bucket must be shown';
  assert not public.community_bucket_shown(10, 1, 10), 'one player must be hidden';
end
$$;

revoke execute on function public.community_max_recorder_share_percent() from public, anon, authenticated;
revoke execute on function public.hero_figure_qualifies(integer, integer, integer) from public, anon, authenticated;
revoke execute on function public.community_bucket_shown(integer, integer, integer) from public, anon, authenticated;
grant execute on function public.community_max_recorder_share_percent() to service_role;
grant execute on function public.hero_figure_qualifies(integer, integer, integer) to service_role;
grant execute on function public.community_bucket_shown(integer, integer, integer) to service_role;
