-- The owner-only read behind a linked player's hero levels, tiers and XP bonuses (issue 863, ADR-0004
-- and ADR-0008). Additive: it adds one function and changes no table or function the overlay calls.
--
-- The levels are worked out in `src/server/hero-progress/` from the matches this returns, with the
-- desktop app's own rules, and nothing about them is stored. This function only hands over the facts
-- those rules read: for each match the account uploaded, when it ended, its mode, half-season and
-- result, the hero on the account's line, and the time on each hero it played.
--
-- It is a second door beside `read_own_dashboard()`, not a change to it, because the dashboard stops at
-- its newest 2,000 lines and a level needs every match: a cut-off history would lower a level. It has
-- no row cap. What bounds it is the retention of `participants` (the half-season after a match's own
-- has ended, or six months), so an all-time level is "all the matches still held", and the server says so.
--
-- Like the dashboard, a line is the account's own only when BOTH hold, each taken from the link and never
-- from the caller: recorded_by = the link's recorder_id, and uid = the link's player_uid. There is nothing
-- to pass and nothing to forge, and `participants` stays closed to clients.

-- Returns {"linked":false} for an account with no link, otherwise {"linked":true,"matches":[...]}, oldest
-- match first. A match is `matchKey` (the line's own id: opaque, different for every match, and never a
-- roster fingerprint), `playedAt` (when it ended), `halfSeason`, `playModeId`, `isWin`, `heroId` (the hero on
-- the line) and `figures` (`heroId`, `seconds`, `damage`, `healing`, `blocked` for each hero played). A blank
-- is JSON `null`, never 0. The recorder, the uid, the name and the roster never leave.
create or replace function public.read_own_hero_progress_matches()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  account uuid := (select auth.uid());
  own_link public.player_links%rowtype;
  found_matches jsonb;
begin
  if account is null then
    raise exception 'Sign in to read your hero levels' using errcode = '28000';
  end if;

  -- An anonymous Supabase session has an account id but no identity worth reading for.
  if coalesce((select auth.jwt()) ->> 'is_anonymous', 'false') = 'true' then
    raise exception 'Create an account to read your hero levels' using errcode = '42501';
  end if;

  select * into own_link from public.player_links where user_id = account;

  if not found then
    return jsonb_build_object('linked', false);
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'matchKey', l.id::text,
      'playedAt', l.played_at,
      'halfSeason', l.half_season,
      'playModeId', l.play_mode_id,
      'isWin', l.is_win,
      'heroId', l.hero_id,
      'figures', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'heroId', f.hero_id,
          'seconds', f.seconds,
          'damage', f.damage_dealt,
          'healing', f.healing,
          'blocked', f.damage_blocked
        ) order by f.hero_id), '[]'::jsonb)
        from public.participant_hero_figures f
        where f.participant_id = l.id
      )
    ) order by l.played_at, l.id
  ), '[]'::jsonb)
  into found_matches
  from public.participants l
  where l.recorded_by = own_link.recorder_id
    and l.uid = own_link.player_uid;

  return jsonb_build_object('linked', true, 'matches', found_matches);
end
$$;

-- Postgres grants EXECUTE to everyone on a new function, and Supabase's default privileges give
-- service_role its own grant too, so it is named here; restate who may call it.
revoke execute on function public.read_own_hero_progress_matches() from public, anon, authenticated, service_role;
grant execute on function public.read_own_hero_progress_matches() to authenticated;
