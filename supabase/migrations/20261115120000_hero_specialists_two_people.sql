-- Lowers the Specialists gate from 5 people per bucket to 2 (issue 871), so pre-launch testing on two accounts
-- can show the panel. Same signature, volatility, search path and grants as `hero_specialist_min_players()` in
-- 20261111120000_hero_specialists.sql (issue 819); only the number changes. The recorder gate (2), the match gate
-- (50) and the reader are untouched. Additive only: no table is touched and nothing is stored.
--
-- Two people is a thin margin for a pooled figure: either could subtract their own record from the total. It is a
-- testing value, to be reviewed before public launch (issue 873).

create or replace function public.hero_specialist_min_players() returns integer
language sql
immutable
set search_path = ''
as $$ select 2 $$;

revoke execute on function public.hero_specialist_min_players() from public, anon, authenticated;
