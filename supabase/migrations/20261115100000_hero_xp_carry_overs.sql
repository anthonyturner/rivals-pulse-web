-- Frozen hero XP, so a linked player's hero levels never fall when the retention purge deletes old
-- matches (issue 868, ADR-0008 Decision 7). Additive: two tables, two helper functions, and a restated
-- `purge_expired_participants`, `forget_player` and `read_own_hero_progress_matches` with the same
-- signatures.
--
-- Levels are worked out on read from the matches `participants` still holds (issue 863). The purge deletes
-- a match once the half-season after its own has ended, or six months on, so before this migration an
-- all-time level lost the XP of every purged match in one step. Now the purge works out the XP of the
-- matches it is about to delete, for the accounts that have a link, and keeps the totals:
--  * `hero_xp_carry_overs`: per account, half-season and game hero id, the XP from playing (base), from the
--    minutes on the hero (time) and from the first-win and rested bonuses (bonus).
--  * `hero_xp_carry_chains`: per account, the end of the last match that earned the first-win bonus and the
--    end of the last counted match, so the next match's bonuses continue across the purge as in the app.
-- No match row, uid, name, fingerprint or recorder is kept: an account id (already in `player_links`) and
-- per-hero totals the player already sees. Both tables belong to the link: unlinking, relinking or
-- deleting the account deletes them (`on delete cascade`), and `forget_player` deletes them too.
--
-- The hero is the game's hero id, not the website's hero key: the database holds no hero catalogue, and the
-- key is one id to one key, so `readOwnHeroProgressMatches` maps it on read. An id the catalogue does not
-- know yet is frozen all the same and counts as soon as the catalogue learns it.
--
-- THE RULES ARE COPIED HERE FROM `src/server/hero-progress/`, deliberately: the purge is a database job and
-- cannot call TypeScript. Storing per-match inputs instead would still need the first-win chain worked out
-- in SQL, and it would keep more than totals. `supabase/checks/hero_xp_carry_overs.sql` holds one fixture
-- that this function must give the same numbers on as the TypeScript (`scripts/hero-xp-carry.test.ts` runs
-- the TypeScript on the same text), and a change to an amount or a gap is made in both places in step.
--  * Only Quick Match (0) and Competitive (1) count.
--  * A hero is credited when its figure has at least 30 seconds or any damage, healing or blocked; a line
--    with no figure at all credits the hero on the line with no time.
--  * base = 100 plus 50 for a win; time = 10 for each full minute, up to 30; bonus = 150 for the first win at
--    least 20 hours after the last first win, plus 100 for a match ending at least 2 hours after the
--    previous counted match. Gaps are end to end, in whole milliseconds.
--  * Matches go in order of end time, a tie broken by the line's id read as text, as the website does.
--
-- A match that reaches the purge after the chain has moved past it (a late upload for a half-season that was
-- already frozen) still earns its base and time XP; it cannot earn a bonus, and the chain never moves back.

create table if not exists public.hero_xp_carry_overs (
  user_id uuid not null references public.player_links (user_id) on delete cascade,
  half_season numeric(4,1) not null,
  hero_id integer not null,
  base_xp integer not null check (base_xp >= 0),
  time_xp integer not null check (time_xp >= 0),
  bonus_xp integer not null check (bonus_xp >= 0),
  primary key (user_id, half_season, hero_id)
);

create table if not exists public.hero_xp_carry_chains (
  user_id uuid primary key references public.player_links (user_id) on delete cascade,
  -- Null until the account has frozen a first-win bonus.
  last_bonus_win_at timestamptz,
  last_counted_at timestamptz not null,
  constraint hero_xp_carry_chains_in_order check (last_bonus_win_at is null or last_bonus_win_at <= last_counted_at)
);

-- Same posture as `participants`: RLS on, no policy, nothing for the publishable key or a signed-in
-- account. The owner reads them only through `read_own_hero_progress_matches`.
alter table public.hero_xp_carry_overs enable row level security;
alter table public.hero_xp_carry_chains enable row level security;
revoke all on public.hero_xp_carry_overs from anon, authenticated;
revoke all on public.hero_xp_carry_chains from anon, authenticated;
grant select, insert, update, delete on public.hero_xp_carry_overs to service_role;
grant select, insert, update, delete on public.hero_xp_carry_chains to service_role;

-- A moment in whole milliseconds, the precision the website reads times at (`Date.parse` drops anything finer),
-- so a gap is measured the same on both sides.
create or replace function public.hero_xp_epoch_ms(p_at timestamptz) returns bigint
language sql
immutable
set search_path = ''
as $$ select floor(extract(epoch from p_at) * 1000)::bigint $$;

-- Works out the XP of every counted match the purge is about to delete, for each account with a link, and adds
-- it to the account's carry-over. `purge_expired_participants` calls it BEFORE it deletes anything, in the
-- same transaction, and asks `participants_past_retention` which rows are going, so the two cannot disagree:
-- any later migration that restates the purge must keep calling it. A line is the account's own only when
-- both recorded_by = the link's recorder_id and uid = the link's player_uid, as the owner's reads take it.
create or replace function public.freeze_hero_xp_carry_overs() returns void
language plpgsql
set search_path = ''
as $$
declare
  own record;
  line record;
  credit record;
  chain_first_win_at timestamptz;
  chain_counted_at timestamptz;
  line_base integer;
  line_bonus integer;
  line_rested boolean;
  line_first_win boolean;
  froze_a_line boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended('hero_xp_carry_overs', 0));

  for own in select k.user_id, k.recorder_id, k.player_uid from public.player_links k loop
    select c.last_bonus_win_at, c.last_counted_at
    into chain_first_win_at, chain_counted_at
    from public.hero_xp_carry_chains c
    where c.user_id = own.user_id;

    froze_a_line := false;

    for line in
      select p.id, p.half_season, p.hero_id, p.is_win, p.played_at
      from public.participants p
      where p.recorded_by = own.recorder_id
        and p.uid = own.player_uid
        and p.play_mode_id in (0, 1)
        and public.participants_past_retention(p.half_season, p.played_at)
      order by public.hero_xp_epoch_ms(p.played_at), p.id::text collate "C"
    loop
      line_rested := chain_counted_at is not null
        and public.hero_xp_epoch_ms(line.played_at) - public.hero_xp_epoch_ms(chain_counted_at) >= 2 * 60 * 60 * 1000;
      line_first_win := line.is_win is true
        and (chain_first_win_at is null
             or public.hero_xp_epoch_ms(line.played_at) - public.hero_xp_epoch_ms(chain_first_win_at) >= 20 * 60 * 60 * 1000);

      line_bonus := (case when line_first_win then 150 else 0 end) + (case when line_rested then 100 else 0 end);
      line_base := 100 + (case when line.is_win is true then 50 else 0 end);

      if line_first_win then
        chain_first_win_at := line.played_at;
      end if;
      chain_counted_at := greatest(chain_counted_at, line.played_at);
      froze_a_line := true;

      for credit in
        select f.hero_id, coalesce(f.seconds, 0) as seconds
        from public.participant_hero_figures f
        where f.participant_id = line.id
          and (coalesce(f.seconds, 0) >= 30 or coalesce(f.damage_dealt, 0) > 0
               or coalesce(f.healing, 0) > 0 or coalesce(f.damage_blocked, 0) > 0)
        union all
        select line.hero_id, 0
        where line.hero_id is not null
          and not exists (select 1 from public.participant_hero_figures f where f.participant_id = line.id)
      loop
        insert into public.hero_xp_carry_overs as o (user_id, half_season, hero_id, base_xp, time_xp, bonus_xp)
        values (
          own.user_id, line.half_season, credit.hero_id, line_base,
          10 * (least(greatest(credit.seconds, 0), 30 * 60) / 60),
          line_bonus
        )
        on conflict (user_id, half_season, hero_id) do update
          set base_xp = o.base_xp + excluded.base_xp,
              time_xp = o.time_xp + excluded.time_xp,
              bonus_xp = o.bonus_xp + excluded.bonus_xp;
      end loop;
    end loop;

    if froze_a_line then
      insert into public.hero_xp_carry_chains (user_id, last_bonus_win_at, last_counted_at)
      values (own.user_id, chain_first_win_at, chain_counted_at)
      on conflict (user_id) do update
        set last_bonus_win_at = excluded.last_bonus_win_at, last_counted_at = excluded.last_counted_at;
    end if;
  end loop;
end
$$;

-- Freezes every aggregate family and the hero XP before deleting; a later restatement must keep calling every
-- freeze. Restated from `20261108190000_hero_switch_in_aggregates.sql` with one more freeze, before the first
-- delete, because the figures the XP reads go with the scoreboard rows (they cascade). Returns the scoreboard
-- rows deleted.
create or replace function public.purge_expired_participants() returns integer
language plpgsql
set search_path = ''
as $$
declare
  removed integer;
begin
  perform public.rebuild_hero_aggregates(due.half_season, true)
  from (
    select p.half_season from public.participants p
    group by p.half_season
    having public.participants_past_retention(p.half_season, min(p.played_at))
  ) due;

  perform public.freeze_extended_aggregates();
  perform public.freeze_hero_pair_aggregates();
  perform public.freeze_triple_support_aggregates();
  perform public.freeze_hero_switch_in_aggregates();
  perform public.freeze_hero_xp_carry_overs();

  delete from public.participants p
  where public.participants_past_retention(p.half_season, p.played_at);
  get diagnostics removed = row_count;

  delete from public.match_hero_kills k
  where public.participants_past_retention(k.half_season, k.played_at);

  delete from public.match_hero_timelines t
  where public.participants_past_retention(t.half_season, t.played_at);

  return removed;
end
$$;

-- Deletes a player's rows and keeps every later upload from storing them again, and now the frozen XP of any
-- link that names the player too. Either argument may be null; a name is matched case-insensitively. Returns
-- the scoreboard rows deleted, as before.
create or replace function public.forget_player(
  p_uid text default null,
  p_name text default null
) returns integer
language plpgsql
set search_path = ''
as $$
declare
  name_key text := lower(btrim(p_name));
  removed integer;
begin
  if nullif(btrim(p_uid), '') is not null then
    insert into public.do_not_store (kind, key) values ('uid', btrim(p_uid))
    on conflict (kind, key) do nothing;
  end if;
  if nullif(name_key, '') is not null then
    insert into public.do_not_store (kind, key) values ('name', name_key)
    on conflict (kind, key) do nothing;
  end if;

  delete from public.participants
  where (nullif(btrim(p_uid), '') is not null and uid = btrim(p_uid))
     or (nullif(name_key, '') is not null and lower(btrim(name)) = name_key);
  get diagnostics removed = row_count;

  delete from public.hero_xp_carry_overs o
  using public.player_links k
  where k.user_id = o.user_id
    and ((nullif(btrim(p_uid), '') is not null and k.player_uid = btrim(p_uid))
      or (nullif(name_key, '') is not null and lower(btrim(k.player_name)) = name_key));

  delete from public.hero_xp_carry_chains c
  using public.player_links k
  where k.user_id = c.user_id
    and ((nullif(btrim(p_uid), '') is not null and k.player_uid = btrim(p_uid))
      or (nullif(name_key, '') is not null and lower(btrim(k.player_name)) = name_key));

  return removed;
end
$$;

-- The owner-only read behind a linked player's hero levels, restated from
-- `20261114100000_hero_progress_matches.sql` with the frozen XP added. Everything it returned is unchanged;
-- a linked answer gains `carry`: `lastBonusWinAt` and `lastCountedAt` (null while nothing is frozen) and
-- `heroes`, one entry per half-season and game hero id with `baseXp`, `timeXp` and `bonusXp`. An all-time
-- level is these totals plus the matches still held, worked out in `src/server/hero-progress/`.
-- The posture is the same: no parameters, the link found through auth.uid(), a line the account's own only
-- when BOTH recorded_by = the link's recorder_id and uid = the link's player_uid.
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
  found_carry jsonb;
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

  select jsonb_build_object(
    'lastBonusWinAt', (select c.last_bonus_win_at from public.hero_xp_carry_chains c where c.user_id = account),
    'lastCountedAt', (select c.last_counted_at from public.hero_xp_carry_chains c where c.user_id = account),
    'heroes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'halfSeason', o.half_season,
        'heroId', o.hero_id,
        'baseXp', o.base_xp,
        'timeXp', o.time_xp,
        'bonusXp', o.bonus_xp
      ) order by o.half_season, o.hero_id)
      from public.hero_xp_carry_overs o
      where o.user_id = account
    ), '[]'::jsonb)
  )
  into found_carry;

  return jsonb_build_object('linked', true, 'matches', found_matches, 'carry', found_carry);
end
$$;

-- Postgres grants EXECUTE to everyone on a new function, and Supabase's default privileges give
-- service_role its own grant too, so it is named here. The freeze and the time helper are for the purge
-- (the service role and the scheduler) only; the reader is for signed-in accounts only.
revoke execute on function public.hero_xp_epoch_ms(timestamptz) from public, anon, authenticated;
revoke execute on function public.freeze_hero_xp_carry_overs() from public, anon, authenticated;
revoke execute on function public.purge_expired_participants() from public, anon, authenticated;
revoke execute on function public.forget_player(text, text) from public, anon, authenticated;
revoke execute on function public.read_own_hero_progress_matches() from public, anon, authenticated, service_role;
grant execute on function public.hero_xp_epoch_ms(timestamptz) to service_role;
grant execute on function public.freeze_hero_xp_carry_overs() to service_role;
grant execute on function public.purge_expired_participants() to service_role;
grant execute on function public.forget_player(text, text) to service_role;
grant execute on function public.read_own_hero_progress_matches() to authenticated;
