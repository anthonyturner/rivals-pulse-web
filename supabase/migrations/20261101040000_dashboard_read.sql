-- The owner-only read behind a linked player's dashboard (issue 329, ADR-0004). Additive: it adds one
-- function and changes no table or function the overlay calls.
--
-- `participants` stays closed to clients (RLS on, no grant), and a service-role route would put an
-- unscoped key behind the website. This definer function is the only door: it finds the caller's link
-- through `auth.uid()` and returns the lines that link can prove are its own, so there is nothing for
-- a caller to pass and nothing to forge.

-- Returns {"linked":false} for an account with no link, otherwise
-- {"linked":true,"name":...,"avatarUrl":...,"truncated":bool,"lines":[...]}, newest line first.
--
-- A line is the player's own only when BOTH hold, each taken from the link and never from the caller:
--   recorded_by = the link's recorder_id  (the verified Overwolf session that uploaded it)
--   uid         = the link's player_uid   (which scoreboard row of that match is the player)
-- A match is stored once, by its first uploader, so a match first uploaded by someone else in the same
-- lobby is not here; neither are backfilled lines, whose recorder is never a link's. A uid alone is
-- only a claim, so another recorder's line with the same uid is not the player's either.
create or replace function public.read_own_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  account uuid := (select auth.uid());
  own_link public.player_links%rowtype;
  -- The most lines one answer carries. A heavy player has about 2,000 lines in the six months that
  -- `participants` is kept; the answer says when more existed.
  line_cap constant integer := 2000;
  found_lines jsonb;
  most_wanted integer;
begin
  if account is null then
    raise exception 'Sign in to read your dashboard' using errcode = '28000';
  end if;

  -- An anonymous Supabase session has an account id but no identity worth reading for.
  if coalesce((select auth.jwt()) ->> 'is_anonymous', 'false') = 'true' then
    raise exception 'Create an account to read your dashboard' using errcode = '42501';
  end if;

  select * into own_link from public.player_links where user_id = account;

  if not found then
    return jsonb_build_object('linked', false);
  end if;

  -- One line more than the cap is read, only to learn whether the cap cut anything off.
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'playedAt', l.played_at,
        'heroId', l.hero_id,
        'kills', l.kills,
        'deaths', l.deaths,
        'assists', l.assists,
        'finalHits', l.final_hits,
        'isWin', l.is_win,
        'playModeId', l.play_mode_id,
        'mapName', l.map_name,
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
      ) order by l.rn
    ) filter (where l.rn <= line_cap), '[]'::jsonb),
    coalesce(max(l.rn), 0)
  into found_lines, most_wanted
  from (
    select p.*, row_number() over (order by p.played_at desc, p.id desc) as rn
    from public.participants p
    where p.recorded_by = own_link.recorder_id
      and p.uid = own_link.player_uid
    order by p.played_at desc, p.id desc
    limit line_cap + 1
  ) l;

  return jsonb_build_object(
    'linked', true,
    'name', own_link.player_name,
    'avatarUrl', own_link.avatar_url,
    'truncated', most_wanted > line_cap,
    'lines', found_lines
  );
end
$$;

-- Postgres grants EXECUTE to everyone on a new function; restate who may call it.
revoke execute on function public.read_own_dashboard() from public, anon, authenticated;
grant execute on function public.read_own_dashboard() to authenticated;
