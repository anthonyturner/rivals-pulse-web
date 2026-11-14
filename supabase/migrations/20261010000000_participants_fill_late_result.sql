-- Issue 785: a match's late result is re-sent as the same match, but `record_match_participants`
-- dropped the whole repeat, so the shared rows kept a blank `is_win`. Same signature as before;
-- only the repeat branch changes, so it is safe to run again.

create or replace function public.record_match_participants(
  p_fingerprint text,
  p_half_season numeric,
  p_played_at timestamptz,
  p_recorded_by text,
  p_players jsonb
) returns integer
language plpgsql
set search_path = ''
as $$
declare
  written integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_fingerprint, 0));

  if exists (
    select 1 from public.participants
    where fingerprint = p_fingerprint
      and played_at between p_played_at - interval '4 minutes' and p_played_at + interval '4 minutes'
  ) then
    -- The same match again (within 4 minutes): add no rows, but fill a blank result. A result that is
    -- already set is never changed, and a repeat that still has no result changes nothing.
    update public.participants as p
    set is_win = x.is_win
    from jsonb_to_recordset(p_players) as x(uid text, name text, is_win boolean)
    where p.fingerprint = p_fingerprint
      and p.played_at between p_played_at - interval '4 minutes' and p_played_at + interval '4 minutes'
      and p.is_win is null
      and x.is_win is not null
      and case
            when x.uid is not null then p.uid = x.uid
            else p.uid is null and lower(btrim(p.name)) = lower(btrim(x.name))
          end;
    return 0;
  end if;

  insert into public.participants
    (fingerprint, half_season, played_at, uid, name, team, hero_id, kills, deaths, assists, is_win, recorded_by)
  select
    p_fingerprint, p_half_season, p_played_at,
    x.uid, x.name, x.team, x.hero_id, x.kills, x.deaths, x.assists, x.is_win, p_recorded_by
  from jsonb_to_recordset(p_players) as x(
    uid text, name text, team smallint, hero_id integer,
    kills integer, deaths integer, assists integer, is_win boolean
  )
  where not exists (
    select 1 from public.do_not_store d
    where (d.kind = 'uid' and d.key = x.uid)
       or (d.kind = 'name' and d.key = lower(btrim(x.name)))
  );

  get diagnostics written = row_count;
  return written;
end
$$;

-- Restated so the grants are right even if this runs on a database where they were changed.
revoke execute on function public.record_match_participants(text, numeric, timestamptz, text, jsonb) from public, anon, authenticated;
grant execute on function public.record_match_participants(text, numeric, timestamptz, text, jsonb) to service_role;
