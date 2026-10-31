-- Issue 141: keep the game mode and the map on every scoreboard row, so stats can be filtered by
-- mode and the history keeps them after the raw match is gone. Additive: existing rows stay null
-- until the backfill fills them, and uploads from an app that sends no mode store null.
--
-- play_mode_id: 0 Quick Match, 1 Competitive, 2 Arcade/Custom, 3 Practice; null when the game did
-- not say. Null is never read as any of them.

alter table public.participants add column if not exists play_mode_id smallint;
alter table public.participants add column if not exists map_name text;

-- The signature grows, so the old function is dropped and the new one created in the same migration.
-- A plain `create or replace` with extra arguments would leave BOTH overloads in place, PostgREST
-- could not choose between them (PGRST203), and every upload would fail. The two new arguments
-- default to null, so the five-named-argument call the deployed function makes still resolves.
drop function if exists public.record_match_participants(text, numeric, timestamptz, text, jsonb);

create function public.record_match_participants(
  p_fingerprint text,
  p_half_season numeric,
  p_played_at timestamptz,
  p_recorded_by text,
  p_players jsonb,
  p_play_mode_id smallint default null,
  p_map_name text default null
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
    -- A repeat upload fills what the first one lacked and never changes what is already known.
    update public.participants as p
    set is_win = coalesce(p.is_win, x.is_win),
        final_hits = coalesce(p.final_hits, x.final_hits)
    from jsonb_to_recordset(p_players) as x(uid text, name text, is_win boolean, final_hits integer)
    where p.fingerprint = p_fingerprint
      and p.played_at between p_played_at - interval '4 minutes' and p_played_at + interval '4 minutes'
      and ((p.is_win is null and x.is_win is not null)
        or (p.final_hits is null and x.final_hits is not null))
      and case
            when x.uid is not null then p.uid = x.uid
            else p.uid is null and lower(btrim(p.name)) = lower(btrim(x.name))
          end;

    -- Mode and map belong to the whole match, so they need no per-player match.
    update public.participants as p
    set play_mode_id = coalesce(p.play_mode_id, p_play_mode_id),
        map_name = coalesce(p.map_name, p_map_name)
    where p.fingerprint = p_fingerprint
      and p.played_at between p_played_at - interval '4 minutes' and p_played_at + interval '4 minutes'
      and ((p.play_mode_id is null and p_play_mode_id is not null)
        or (p.map_name is null and p_map_name is not null));

    return 0;
  end if;

  insert into public.participants
    (fingerprint, half_season, played_at, uid, name, team, hero_id, kills, deaths, assists, final_hits, is_win,
     play_mode_id, map_name, recorded_by)
  select
    p_fingerprint, p_half_season, p_played_at,
    x.uid, x.name, x.team, x.hero_id, x.kills, x.deaths, x.assists, x.final_hits, x.is_win,
    p_play_mode_id, p_map_name, p_recorded_by
  from jsonb_to_recordset(p_players) as x(
    uid text, name text, team smallint, hero_id integer,
    kills integer, deaths integer, assists integer, final_hits integer, is_win boolean
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

-- Postgres grants EXECUTE to everyone on a new function, so the grants are stated again.
revoke execute on function public.record_match_participants(text, numeric, timestamptz, text, jsonb, smallint, text) from public, anon, authenticated;
grant execute on function public.record_match_participants(text, numeric, timestamptz, text, jsonb, smallint, text) to service_role;
