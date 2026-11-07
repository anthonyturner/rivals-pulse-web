begin;

do $$
declare
  payload jsonb;
  row_data jsonb;
  n integer;
begin
  if exists (select 1 from public.hero_figure_aggregates where half_season = 997) or
     exists (select 1 from public.hero_ability_aggregates where half_season = 997) then
    raise exception 'test half-season already exists';
  end if;

  for n in 9..10 loop
    insert into public.hero_figure_aggregates
      (half_season, play_mode_id, hero_id, segments, seconds_sum, seconds_n,
       damage_sum, damage_n, damage_seconds, healing_sum, healing_n, healing_seconds,
       blocked_sum, blocked_n, blocked_seconds, recorders, top_recorder_segments,
       damage_recorders, damage_top_recorder_n, healing_recorders, healing_top_recorder_n,
       blocked_recorders, blocked_top_recorder_n)
    values (997, 0, n, n, 600, n, 6000, n, 600, 3000, n, 600, 1000, n, 600,
            1, n, 1, n, 1, n, 1, n);
    insert into public.hero_ability_aggregates
      (half_season, play_mode_id, hero_id, slot, segments, uses_sum, uses_timed_sum,
       seconds_sum, kills_after_sum, kills_after_n, assists_after_sum, assists_after_n,
       recorders, top_recorder_segments)
    values (997, 0, n, 'ultimate', n, 20, 20, 600, 5, n, 5, n, 1, n);
  end loop;

  payload := public.read_community_hero_scores();
  for n in 9..10 loop
    select value into strict row_data from jsonb_array_elements(payload->'figures')
      where (value->>'half_season')::numeric = 997 and (value->>'hero_id')::integer = n;
    if (row_data->>'damage_qualifies')::boolean <> (n = 10) or
       (row_data->>'healing_qualifies')::boolean <> (n = 10) or
       (row_data->>'blocked_qualifies')::boolean <> (n = 10) or
       (row_data->>'damage_sum')::integer <> (case when n = 10 then 6000 else 0 end) or
       (row_data->>'healing_sum')::integer <> (case when n = 10 then 3000 else 0 end) or
       (row_data->>'blocked_sum')::integer <> (case when n = 10 then 1000 else 0 end) then
      raise exception 'figure threshold failed at %', n;
    end if;
    select value into strict row_data from jsonb_array_elements(payload->'abilities')
      where (value->>'half_season')::numeric = 997 and (value->>'hero_id')::integer = n;
    if (row_data->>'qualifies')::boolean <> (n = 10) or
       (row_data->>'uses_sum')::integer <> (case when n = 10 then 20 else 0 end) then
      raise exception 'ability threshold failed at %', n;
    end if;
  end loop;

  if public.hero_figure_qualifies(10, 1, 10) then
    raise exception 'shared community rule changed';
  end if;
  if has_function_privilege('anon', 'public.read_community_hero_scores()', 'execute') or
     has_function_privilege('authenticated', 'public.read_community_hero_scores()', 'execute') or
     not has_function_privilege('service_role', 'public.read_community_hero_scores()', 'execute') then
    raise exception 'reader permissions changed';
  end if;
end
$$;

rollback;
