-- Private export: set app.season_11_recorder and app.season_11_before in this transaction.
-- Redirect CLI output to a private file; it contains raw match and player identifiers.
with tracked as (
  select t.* from public.tracked_matches t join public.tracked_match_recorders r on r.tracked_match_id = t.id
  where r.recorded_by = current_setting('app.season_11_recorder')
    and t.played_at >= '2026-11-13T11:00:00Z'
    and t.played_at < current_setting('app.season_11_before')::timestamptz
), keys as (
  select distinct p.fingerprint, p.played_at from public.participants p join tracked t using (played_at)
  where p.recorded_by = current_setting('app.season_11_recorder')
), raw_lines as (
  select p.* from public.participants p where p.half_season = 10
    or exists (select 1 from keys k where k.fingerprint = p.fingerprint and k.played_at = p.played_at)
)
select jsonb_build_object(
  'exported_at', now(),
  'half_seasons', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.half_seasons t),
  'tracked_matches', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from tracked t),
  'tracked_match_recorders', (select coalesce(jsonb_agg(to_jsonb(r)), '[]') from public.tracked_match_recorders r join tracked t on t.id = r.tracked_match_id),
  'participants', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from raw_lines t),
  'participant_hero_figures', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.participant_hero_figures t join raw_lines p on p.id = t.participant_id),
  'participant_hero_ability_uses', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.participant_hero_ability_uses t join raw_lines p on p.id = t.participant_id),
  'match_hero_kills', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.match_hero_kills t where t.half_season = 10 or exists (select 1 from keys k where k.fingerprint = t.fingerprint and k.played_at = t.played_at)),
  'match_hero_timelines', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.match_hero_timelines t where t.half_season = 10 or exists (select 1 from keys k where k.fingerprint = t.fingerprint and k.played_at = t.played_at)),
  'hero_aggregates', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.hero_aggregates t where half_season in (10, 10.5, 11)),
  'hero_aggregate_totals', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.hero_aggregate_totals t where half_season in (10, 10.5, 11)),
  'hero_matchups', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.hero_matchups t where half_season in (10, 10.5, 11)),
  'hero_figure_aggregates', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.hero_figure_aggregates t where half_season in (10, 10.5, 11)),
  'hero_ability_aggregates', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.hero_ability_aggregates t where half_season in (10, 10.5, 11)),
  'hero_kill_aggregates', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.hero_kill_aggregates t where half_season in (10, 10.5, 11)),
  'hero_kill_totals', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.hero_kill_totals t where half_season in (10, 10.5, 11)),
  'community_map_aggregates', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.community_map_aggregates t where half_season in (10, 10.5, 11)),
  'community_mode_aggregates', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.community_mode_aggregates t where half_season in (10, 10.5, 11)),
  'community_day_aggregates', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.community_day_aggregates t where half_season in (10, 10.5, 11)),
  'play_time_aggregates', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.play_time_aggregates t where half_season in (10, 10.5, 11)),
  'hero_pair_aggregates', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.hero_pair_aggregates t where half_season in (10, 10.5, 11)),
  'hero_pair_totals', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.hero_pair_totals t where half_season in (10, 10.5, 11)),
  'triple_support_trios', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.triple_support_trios t where half_season in (10, 10.5, 11)),
  'team_lineup_shapes', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.team_lineup_shapes t where half_season in (10, 10.5, 11)),
  'triple_support_totals', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.triple_support_totals t where half_season in (10, 10.5, 11)),
  'hero_switch_ins', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.hero_switch_ins t where half_season in (10, 10.5, 11)),
  'freeze_metadata', jsonb_build_object(
    'hero_aggregate_half_seasons', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.hero_aggregate_half_seasons t),
    'extended_aggregate_half_seasons', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.extended_aggregate_half_seasons t),
    'hero_pair_aggregate_half_seasons', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.hero_pair_aggregate_half_seasons t),
    'triple_support_aggregate_half_seasons', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.triple_support_aggregate_half_seasons t),
    'hero_switch_in_aggregate_half_seasons', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.hero_switch_in_aggregate_half_seasons t),
    'community_match_half_seasons', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.community_match_half_seasons t),
    'play_time_aggregate_half_seasons', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.play_time_aggregate_half_seasons t)
  )
) as backup;
