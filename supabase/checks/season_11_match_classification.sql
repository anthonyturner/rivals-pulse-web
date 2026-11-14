-- Include inside the migration preflight transaction. Every fixture is removed before returning.
do $checks$
declare
  fixture_player bigint;
  boundary constant timestamptz := '2026-11-13T11:00:00Z';
begin
  if public.match_half_season_at(boundary - interval '1 millisecond') is distinct from 10.5
    or public.match_half_season_at(boundary) is distinct from 11 then
    raise exception 'Season boundary lookup failed';
  end if;
  if has_function_privilege('anon', 'public.repair_season_11_matches(text,timestamptz,integer)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.repair_season_11_matches(text,timestamptz,integer)', 'EXECUTE') then
    raise exception 'The repair must not be callable by client roles';
  end if;
  if exists (select 1 from public.tracked_matches where id = -854)
    or exists (select 1 from public.participants where id = -854)
    or exists (select 1 from public.match_hero_kills where id = -854)
    or exists (select 1 from public.match_hero_timelines where id = -854) then
    raise exception 'Reserved test fixture IDs already exist';
  end if;
  select player_id into fixture_player from public.tracked_matches order by id limit 1;
  if fixture_player is null then raise exception 'A tracked player is required for the preflight fixture'; end if;
  insert into public.tracked_matches (id, player_id, provider, match_uid, played_at, raw_payload)
    values (-854, fixture_player, 'gep', 'season-11-classification-check', boundary, '{"match_season":10.5}');
  insert into public.participants (id, fingerprint, half_season, played_at, name, recorded_by)
    values (-854, 'season-11-classification-check', 10.5, boundary, 'classification fixture', 'classification fixture');
  insert into public.match_hero_kills (id, fingerprint, half_season, played_at, killer_hero, victim_hero, kills)
    values (-854, 'season-11-classification-check', 10.5, boundary, 'adam-warlock', 'loki', 1);
  insert into public.match_hero_timelines (id, fingerprint, half_season, played_at, team, timeline_no, pick_no, hero_id, at_second)
    values (-854, 'season-11-classification-check', 10.5, boundary, 0, 1, 1, 1046, 0);
  if (select raw_payload ->> 'match_season' from public.tracked_matches where id = -854)::numeric <> 11
    or (select half_season from public.participants where id = -854) <> 11
    or (select half_season from public.match_hero_kills where id = -854) <> 11
    or (select half_season from public.match_hero_timelines where id = -854) <> 11 then
    raise exception 'A stale client insert was not normalized';
  end if;
  update public.tracked_matches set played_at = boundary - interval '1 millisecond', raw_payload = '{"match_season":11}' where id = -854;
  update public.participants set played_at = boundary - interval '1 millisecond', half_season = 11 where id = -854;
  if (select raw_payload ->> 'match_season' from public.tracked_matches where id = -854)::numeric <> 10.5
    or (select half_season from public.participants where id = -854) <> 10.5 then
    raise exception 'A pre-boundary update was not normalized';
  end if;
  delete from public.match_hero_timelines where id = -854;
  delete from public.match_hero_kills where id = -854;
  delete from public.participants where id = -854;
  delete from public.tracked_matches where id = -854;
  raise notice 'Season lookup, stale inserts, pre-boundary updates and client-role restrictions passed';
end
$checks$;
