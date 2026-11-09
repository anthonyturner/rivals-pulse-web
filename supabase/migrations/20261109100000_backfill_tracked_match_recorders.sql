-- Issue 697: return the matches uploaded before `tracked_match_recorders` existed (issue 328) to
-- their recorder, so `read_own_tracked_matches` returns them on a fresh install or a new PC.
--
-- Those uploads stored no recorder: the table holds no hash, and the scoreboard lines of an older
-- payload carry only uid, nick_name, camp, hero, kills, deaths and assists. The one evidence left is
-- the player a match was filed under (`tracked_matches.player_id`, the name the app claimed). So a
-- match is tied to a recorder only when every match already recorded under that player names the same
-- one recorder, and the match does not contradict it: its own `player_uid`, when it has one, is a uid
-- those recorded matches carry. A player whose recorded matches name two recorders is ambiguous and a
-- player with none has no evidence, so both stay untied.
--
-- A name is a claim, so this is the best evidence there is and not proof. It is safe to rest on here
-- because it can only hand a match to the recorder already holding every other match filed under that
-- name, and the match was already readable by anyone through the `anon` select on `tracked_matches`.
--
-- The function is idempotent and only ever adds rows, so it can run again to tie a match whose recorder
-- write failed (`track-match-history` logs that failure and carries on). Service role only.

create or replace function public.backfill_tracked_match_recorders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  tied integer;
begin
  with sole_recorder as (
    select tm.player_id,
           min(r.recorded_by) as recorder,
           array_agg(distinct tm.performance ->> 'player_uid')
             filter (where tm.performance ->> 'player_uid' is not null) as uids
    from public.tracked_match_recorders r
    join public.tracked_matches tm on tm.id = r.tracked_match_id
    group by tm.player_id
    having count(distinct r.recorded_by) = 1
  ), inserted as (
    insert into public.tracked_match_recorders (tracked_match_id, recorded_by, recorded_at)
    select tm.id, sole.recorder, tm.recorded_at
    from public.tracked_matches tm
    join sole_recorder sole on sole.player_id = tm.player_id
    where not exists (
            select 1 from public.tracked_match_recorders r where r.tracked_match_id = tm.id
          )
      and (tm.performance ->> 'player_uid' is null
           or tm.performance ->> 'player_uid' = any (sole.uids))
    on conflict (tracked_match_id) do nothing
    returning 1
  )
  select count(*) into tied from inserted;

  return tied;
end
$$;

revoke execute on function public.backfill_tracked_match_recorders() from public, anon, authenticated;
grant execute on function public.backfill_tracked_match_recorders() to service_role;

select public.backfill_tracked_match_recorders();
