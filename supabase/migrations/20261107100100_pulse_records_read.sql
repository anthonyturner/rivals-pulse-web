-- Pulse Records: the one read behind the best-matches boards. Additive: two helper functions, one
-- hand-kept list and the read function. No existing table or function changes.
--
-- `participants` stays closed to clients. This definer function is the only door, and it returns
-- numbers, hero ids and, for a player who opted in, the name of their link. It never returns a uid,
-- a recorder, a line id or a match time.

-- Lines the site owner hides by hand (an obvious forgery), keyed by the scoreboard line so that
-- retention and `forget_player` remove the entry with the line. Closed to every API role: it is
-- edited with `npx supabase db query --linked`.
create table if not exists public.records_hidden (
  participant_id bigint primary key references public.participants (id) on delete cascade,
  hidden_at timestamptz not null default now(),
  note text
);

alter table public.records_hidden enable row level security;
revoke all on public.records_hidden from anon, authenticated, service_role;

-- The plausibility ceilings, chosen from the real uploads on 2026-11-07 (Quick Match and
-- Competitive): about 1.5 times the largest value seen for kills, assists and final hits, and the
-- largest damage and blocked segments seen with a margin. Healing has no support rows to calibrate
-- from yet, so its ceiling comes from what the game allows. The read function applies them when it
-- runs, so restating these two functions in a later migration changes the boards with no rebuild.
create or replace function public.pulse_records_value_cap(p_category text) returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_category
    when 'kills' then 100
    when 'assists' then 100
    when 'final_hits' then 60
    when 'damage' then 40000
    when 'healing' then 80000
    when 'blocked' then 65000
  end
$$;

-- The most a hero segment may show per minute played. Null for a category that is not a figure.
create or replace function public.pulse_records_rate_cap(p_category text) returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_category
    when 'damage' then 5000
    when 'healing' then 6000
    when 'blocked' then 10000
  end
$$;

-- Internal helpers: the definer function below calls them as its owner, so no API role may.
revoke execute on function public.pulse_records_value_cap(text) from public, anon, authenticated, service_role;
revoke execute on function public.pulse_records_rate_cap(text) from public, anon, authenticated, service_role;

-- Returns {"coveredFrom":"YYYY-MM-DD"|null,"categories":[{"key":...,"rows":[{"heroId","value","name"}]}]}
-- with up to 50 rows per category, best first, in the order kills, assists, final_hits, damage,
-- healing, blocked. `name` is null for an anonymous line.
--
-- Which lines count (each guard is in the `lines` step):
--   * Quick Match and Competitive only (`play_mode_id` 0 or 1), and a real hero.
--   * Not hidden, and not a player in `do_not_store`.
--   * A line is named only when BOTH its recorder and its uid match a link (`recorded_by =
--     recorder_id` AND `uid = player_uid`) and that account switched naming on; the name is the
--     link's, never `participants.name`. A uid is a claim, so a line carrying a linked player's uid
--     from any other uploader is left off the board rather than shown anonymously beside their name.
--     A linked player who has not switched naming on is left off too.
--   * Damage, healing and blocked come from the uploader's own line, which only a named player can
--     prove, so those boards hold named players only.
--   * A value must be above 0 and within its ceiling, and a figure also needs time played and a
--     per-minute rate within its ceiling.
--   * One row per player (the linked account, else the uid, else the lower-cased name), then one row
--     per uploader. On a tie the earlier match wins.
create or replace function public.read_pulse_records() returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with lines as (
    select
      p.id, p.played_at, p.recorded_by, p.hero_id, p.kills, p.assists, p.final_hits,
      case
        when own.user_id is not null then 'account:' || own.user_id::text
        when p.uid is not null then 'uid:' || p.uid
        else 'name:' || lower(btrim(p.name))
      end as player_key,
      own.user_id is not null as is_named,
      nullif(btrim(regexp_replace(
        own.player_name,
        '[\u0001-\u001f\u007f-\u009f\u061c\u200b-\u200f\u2028-\u202e\u2060-\u2069\ufeff]', '', 'g'
      )), '') as shown_name
    from public.participants p
    left join public.player_links own
      on own.recorder_id = p.recorded_by and own.player_uid = p.uid
    left join public.account_settings s on s.user_id = own.user_id
    where p.play_mode_id in (0, 1)
      and p.hero_id > 0
      and not exists (select 1 from public.records_hidden h where h.participant_id = p.id)
      and not exists (
        select 1 from public.do_not_store d
        where (d.kind = 'uid' and d.key = p.uid)
           or (d.kind = 'name' and d.key = lower(btrim(p.name)))
      )
      and (own.user_id is not null
           or not exists (select 1 from public.player_links claimed where claimed.player_uid = p.uid))
      and (own.user_id is null or coalesce(s.show_in_records, false))
  ),
  candidates as (
    select c.category, l.id, l.played_at, l.recorded_by, l.player_key, l.shown_name, l.hero_id, c.value
    from lines l
    cross join lateral (values ('kills', l.kills), ('assists', l.assists), ('final_hits', l.final_hits)) as c(category, value)
    where c.value between 1 and public.pulse_records_value_cap(c.category)
    union all
    select c.category, l.id, l.played_at, l.recorded_by, l.player_key, l.shown_name, f.hero_id, c.value
    from lines l
    join public.participant_hero_figures f on f.participant_id = l.id
    cross join lateral (
      values ('damage', f.damage_dealt), ('healing', f.healing), ('blocked', f.damage_blocked)
    ) as c(category, value)
    where l.is_named
      and f.hero_id > 0
      and f.seconds > 0
      and c.value between 1 and public.pulse_records_value_cap(c.category)
      and c.value * 60.0 / f.seconds <= public.pulse_records_rate_cap(c.category)
  ),
  per_player as (
    select distinct on (category, player_key) *
    from candidates
    order by category, player_key, value desc, played_at, id
  ),
  per_uploader as (
    select distinct on (category, recorded_by) *
    from per_player
    order by category, recorded_by, value desc, played_at, id
  ),
  ranked as materialized (
    select u.*, row_number() over (partition by u.category order by u.value desc, u.played_at, u.id) as place
    from per_uploader u
  )
  select jsonb_build_object(
    'coveredFrom', (
      select to_char(min(p.played_at) at time zone 'utc', 'YYYY-MM-DD')
      from public.participants p
      where p.play_mode_id in (0, 1)
    ),
    'categories', (
      select jsonb_agg(
        jsonb_build_object(
          'key', k.key,
          'rows', coalesce((
            select jsonb_agg(
              jsonb_build_object('heroId', r.hero_id, 'value', r.value, 'name', r.shown_name)
              order by r.place
            )
            from ranked r
            where r.category = k.key and r.place <= 50
          ), '[]'::jsonb)
        )
        order by k.ord
      )
      from (values (1, 'kills'), (2, 'assists'), (3, 'final_hits'), (4, 'damage'), (5, 'healing'), (6, 'blocked'))
        as k(ord, key)
    )
  )
$$;

-- Postgres grants EXECUTE to everyone on a new function; this is for the web server and nobody else,
-- the publishable key included.
revoke execute on function public.read_pulse_records() from public, anon, authenticated, service_role;
grant execute on function public.read_pulse_records() to service_role;
