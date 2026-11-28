-- The confirmed gameplay boundary is 06:00 Eastern, not the earlier maintenance start.
insert into public.half_seasons (half_season, starts_at)
values (11, '2026-11-13T11:00:00Z')
on conflict (half_season) do nothing;

do $$
begin
  if not exists (select 1 from public.half_seasons where half_season = 11 and starts_at = '2026-11-13T11:00:00Z') then
    raise exception 'Season 11 already has a different boundary; refusing to replace it';
  end if;
end
$$;

create or replace function public.match_half_season_at(p_played_at timestamptz) returns numeric
language sql stable security definer set search_path = ''
as $$
  select h.half_season from public.half_seasons h
  where h.starts_at <= p_played_at order by h.starts_at desc limit 1
$$;

-- Old deployed clients still send their bundled season; normalize at the shared write boundary.
create or replace function public.normalize_match_half_season() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.half_season := coalesce(public.match_half_season_at(new.played_at), new.half_season);
  return new;
end
$$;

create or replace function public.normalize_tracked_match_half_season() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  canonical numeric := public.match_half_season_at(new.played_at);
begin
  if canonical is not null then
    new.raw_payload := jsonb_set(new.raw_payload, '{match_season}', to_jsonb(canonical), true);
  end if;
  return new;
end
$$;

drop trigger if exists normalize_match_half_season on public.participants;
create trigger normalize_match_half_season before insert or update of played_at, half_season
on public.participants for each row execute function public.normalize_match_half_season();
drop trigger if exists normalize_match_half_season on public.match_hero_kills;
create trigger normalize_match_half_season before insert or update of played_at, half_season
on public.match_hero_kills for each row execute function public.normalize_match_half_season();
drop trigger if exists normalize_match_half_season on public.match_hero_timelines;
create trigger normalize_match_half_season before insert or update of played_at, half_season
on public.match_hero_timelines for each row execute function public.normalize_match_half_season();
drop trigger if exists normalize_tracked_match_half_season on public.tracked_matches;
create trigger normalize_tracked_match_half_season before insert or update of played_at, raw_payload
on public.tracked_matches for each row execute function public.normalize_tracked_match_half_season();

create or replace function public.repair_season_11_matches(
  p_recorded_by text, p_before timestamptz, p_expected_matches integer
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  cutoff constant timestamptz := '2026-11-13T11:00:00Z';
  family text;
  season numeric;
  cohort_count integer;
  tracked_changed integer;
  participants_changed integer;
  kills_changed integer;
  timelines_changed integer;
  before_signature text;
  after_signature text;
  before_details jsonb;
  after_details jsonb;
  earlier_before text;
  earlier_after text;
begin
  if p_recorded_by is null or btrim(p_recorded_by) = '' or p_before is null
    or p_before <= cutoff or p_before > now()
    or p_expected_matches is null or p_expected_matches not between 1 and 1000 then
    raise exception 'A verified recorder, bounded past window and expected match count are required';
  end if;
  if not exists (select 1 from public.player_links where recorder_id = p_recorded_by) then
    raise exception 'The repair recorder has no verified account link';
  end if;
  if public.match_half_season_at(cutoff) is distinct from 11
    or public.match_half_season_at(p_before - interval '1 microsecond') is distinct from 11 then
    raise exception 'The repair interval is not wholly inside the confirmed Season 11 boundary';
  end if;

  -- Take family locks before raw-table locks, as purge takes family locks before deleting raw rows.
  foreach family in array array['hero_aggregates', 'extended_aggregates', 'hero_pair_aggregates',
    'triple_support_aggregates', 'hero_switch_in_aggregates', 'community_match_aggregates', 'play_time_aggregates'] loop
    perform pg_advisory_xact_lock(hashtextextended(family, 0));
  end loop;
  lock table public.tracked_matches, public.tracked_match_recorders, public.participants,
    public.match_hero_kills, public.match_hero_timelines in share row exclusive mode;

  if exists (
    select half_season from public.hero_aggregate_half_seasons where frozen_at is not null and half_season in (10.5, 11)
    union all select half_season from public.extended_aggregate_half_seasons where frozen_at is not null and half_season in (10.5, 11)
    union all select half_season from public.hero_pair_aggregate_half_seasons where frozen_at is not null and half_season in (10.5, 11)
    union all select half_season from public.triple_support_aggregate_half_seasons where frozen_at is not null and half_season in (10.5, 11)
    union all select half_season from public.hero_switch_in_aggregate_half_seasons where frozen_at is not null and half_season in (10.5, 11)
    union all select half_season from public.community_match_half_seasons where frozen_at is not null and half_season in (10.5, 11)
    union all select half_season from public.play_time_aggregate_half_seasons where frozen_at is not null and half_season in (10.5, 11)
  ) then
    raise exception 'An affected aggregate family is frozen; refusing to unfreeze retained data';
  end if;

  drop table if exists pg_temp.season_11_repair_tracked;
  create temporary table season_11_repair_tracked on commit drop as
    select t.id, t.played_at from public.tracked_matches t
    join public.tracked_match_recorders r on r.tracked_match_id = t.id
    where r.recorded_by = p_recorded_by and t.played_at >= cutoff and t.played_at < p_before;
  select count(*) into cohort_count from pg_temp.season_11_repair_tracked;
  if cohort_count <> p_expected_matches or
    (select count(distinct played_at) from pg_temp.season_11_repair_tracked) <> cohort_count then
    raise exception 'The tracked cohort differs from the audited count or has ambiguous timestamps';
  end if;
  if exists (select 1 from public.tracked_matches t join pg_temp.season_11_repair_tracked c using (id)
    where t.raw_payload ->> 'match_season' is null or t.raw_payload ->> 'match_season' not in ('10.5', '11', '11.0')) then
    raise exception 'The cohort contains an unexpected stored season';
  end if;

  drop table if exists pg_temp.season_11_repair_keys;
  create temporary table season_11_repair_keys on commit drop as
    select distinct p.fingerprint, p.played_at from public.participants p
    join pg_temp.season_11_repair_tracked c on c.played_at = p.played_at
    where p.recorded_by = p_recorded_by;
  if (select count(*) from pg_temp.season_11_repair_keys) <> cohort_count then
    raise exception 'Each audited tracked match must map to exactly one recorder scoreboard';
  end if;
  if exists (
    select c.id from pg_temp.season_11_repair_tracked c
    left join public.participants p on p.played_at = c.played_at and p.recorded_by = p_recorded_by
    group by c.id having count(distinct p.fingerprint) <> 1
  ) then
    raise exception 'A tracked timestamp has a missing or ambiguous recorder scoreboard';
  end if;
  if exists (select 1 from public.participants p join pg_temp.season_11_repair_keys c using (fingerprint, played_at)
    where p.half_season not in (10.5, 11)
    union all select 1 from public.match_hero_kills k join pg_temp.season_11_repair_keys c using (fingerprint, played_at)
    where k.half_season not in (10.5, 11)
    union all select 1 from public.match_hero_timelines t join pg_temp.season_11_repair_keys c using (fingerprint, played_at)
    where t.half_season not in (10.5, 11)) then
    raise exception 'A scoreboard or extra record contains an unexpected season';
  end if;

  select md5(coalesce(jsonb_agg(to_jsonb(p) - 'half_season' order by p.id)::text, '')) into before_signature
    from public.participants p join pg_temp.season_11_repair_keys c using (fingerprint, played_at);
  select md5(coalesce(jsonb_agg(to_jsonb(p) order by p.id)::text, '')) into earlier_before
    from public.participants p where p.half_season = 10.5 and not exists (
      select 1 from pg_temp.season_11_repair_keys c where c.fingerprint = p.fingerprint and c.played_at = p.played_at
    );
  select jsonb_build_object(
    'tracked', (select md5(coalesce(jsonb_agg((to_jsonb(t) - 'raw_payload') || jsonb_build_object('raw_payload', t.raw_payload - 'match_season') order by t.id)::text, ''))
      from public.tracked_matches t join pg_temp.season_11_repair_tracked c using (id)),
    'kills', (select md5(coalesce(jsonb_agg(to_jsonb(k) - 'half_season' order by k.id)::text, ''))
      from public.match_hero_kills k join pg_temp.season_11_repair_keys c using (fingerprint, played_at)),
    'timelines', (select md5(coalesce(jsonb_agg(to_jsonb(t) - 'half_season' order by t.id)::text, ''))
      from public.match_hero_timelines t join pg_temp.season_11_repair_keys c using (fingerprint, played_at))
  ) into before_details;
  update public.tracked_matches t set raw_payload = jsonb_set(t.raw_payload, '{match_season}', '11'::jsonb, true)
    from pg_temp.season_11_repair_tracked c where t.id = c.id and t.raw_payload ->> 'match_season' = '10.5';
  get diagnostics tracked_changed = row_count;
  update public.participants p set half_season = 11 from pg_temp.season_11_repair_keys c
    where p.fingerprint = c.fingerprint and p.played_at = c.played_at and p.half_season = 10.5;
  get diagnostics participants_changed = row_count;
  update public.match_hero_kills k set half_season = 11 from pg_temp.season_11_repair_keys c
    where k.fingerprint = c.fingerprint and k.played_at = c.played_at and k.half_season = 10.5;
  get diagnostics kills_changed = row_count;
  update public.match_hero_timelines t set half_season = 11 from pg_temp.season_11_repair_keys c
    where t.fingerprint = c.fingerprint and t.played_at = c.played_at and t.half_season = 10.5;
  get diagnostics timelines_changed = row_count;
  select md5(coalesce(jsonb_agg(to_jsonb(p) - 'half_season' order by p.id)::text, '')) into after_signature
    from public.participants p join pg_temp.season_11_repair_keys c using (fingerprint, played_at);
  if before_signature is distinct from after_signature then
    raise exception 'A scoreboard field other than season changed';
  end if;
  select md5(coalesce(jsonb_agg(to_jsonb(p) order by p.id)::text, '')) into earlier_after
    from public.participants p where p.half_season = 10.5 and not exists (
      select 1 from pg_temp.season_11_repair_keys c where c.fingerprint = p.fingerprint and c.played_at = p.played_at
    );
  select jsonb_build_object(
    'tracked', (select md5(coalesce(jsonb_agg((to_jsonb(t) - 'raw_payload') || jsonb_build_object('raw_payload', t.raw_payload - 'match_season') order by t.id)::text, ''))
      from public.tracked_matches t join pg_temp.season_11_repair_tracked c using (id)),
    'kills', (select md5(coalesce(jsonb_agg(to_jsonb(k) - 'half_season' order by k.id)::text, ''))
      from public.match_hero_kills k join pg_temp.season_11_repair_keys c using (fingerprint, played_at)),
    'timelines', (select md5(coalesce(jsonb_agg(to_jsonb(t) - 'half_season' order by t.id)::text, ''))
      from public.match_hero_timelines t join pg_temp.season_11_repair_keys c using (fingerprint, played_at))
  ) into after_details;
  if earlier_before is distinct from earlier_after or before_details is distinct from after_details then
    raise exception 'An earlier scoreboard or non-season tracked/extra field changed';
  end if;
  if exists (select 1 from public.tracked_matches t join pg_temp.season_11_repair_tracked c using (id)
      where (t.raw_payload ->> 'match_season')::numeric is distinct from 11)
    or exists (select 1 from public.participants p join pg_temp.season_11_repair_keys c using (fingerprint, played_at) where p.half_season is distinct from 11)
    or exists (select 1 from public.match_hero_kills k join pg_temp.season_11_repair_keys c using (fingerprint, played_at) where k.half_season is distinct from 11)
    or exists (select 1 from public.match_hero_timelines t join pg_temp.season_11_repair_keys c using (fingerprint, played_at) where t.half_season is distinct from 11) then
    raise exception 'A targeted row still has an incorrect season';
  end if;
  if not exists (select 1 from public.participants where half_season = 10.5) then
    raise exception 'No old-season raw rows remain; the standard rebuild would leave stale counts';
  end if;

  foreach season in array array[10.5::numeric, 11::numeric] loop
    if not public.rebuild_hero_aggregates(season, false)
      or not public.rebuild_extended_aggregates(season, false)
      or not public.rebuild_hero_pair_aggregates(season, false)
      or not public.rebuild_triple_support_aggregates(season, false)
      or not public.rebuild_hero_switch_in_aggregates(season, false)
      or not public.rebuild_community_match_aggregates(season, false)
      or not public.rebuild_play_time_aggregates(season, false) then
      raise exception 'An aggregate family could not rebuild season %', season;
    end if;
  end loop;
  return jsonb_build_object('matches', cohort_count, 'tracked_changed', tracked_changed,
    'participants_changed', participants_changed, 'kill_rows_changed', kills_changed,
    'timeline_rows_changed', timelines_changed, 'seasons_rebuilt', jsonb_build_array(10.5, 11));
end
$$;

revoke all on function public.match_half_season_at(timestamptz) from public, anon, authenticated;
revoke all on function public.normalize_match_half_season() from public, anon, authenticated;
revoke all on function public.normalize_tracked_match_half_season() from public, anon, authenticated;
revoke all on function public.repair_season_11_matches(text, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.match_half_season_at(timestamptz) to service_role;
grant execute on function public.repair_season_11_matches(text, timestamptz, integer) to service_role;
