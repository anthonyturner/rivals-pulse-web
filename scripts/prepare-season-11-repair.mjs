import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cutoff = Date.parse('2026-11-13T11:00:00Z');
const migration = 'supabase/migrations/20261113160000_season_11_match_classification.sql';
const families = ['hero_aggregates', 'extended_aggregates', 'hero_pair_aggregates',
  'triple_support_aggregates', 'hero_switch_in_aggregates', 'community_match_aggregates', 'play_time_aggregates'];

export function repairParameters(cohort) {
  const matches = cohort?.matches;
  if (!Array.isArray(matches) || matches.length === 0 || matches.length > 1000) throw new Error('Expected a nonempty bounded private cohort');
  const recorder = matches[0].recorded_by;
  if (typeof recorder !== 'string' || !/^[a-f0-9]{64}$/i.test(recorder)) throw new Error('Invalid recorder digest');
  for (const match of matches) {
    if (match.has_verified_link !== true || match.recorded_by !== recorder ||
      !Number.isSafeInteger(match.id) || match.id <= 0 ||
      !Number.isFinite(Date.parse(match.played_at)) || Date.parse(match.played_at) < cutoff) {
      throw new Error('Private cohort has an unverified, mixed or invalid match');
    }
  }
  const ids = matches.map(match => match.id).sort((a, b) => a - b);
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate tracked match IDs');
  return { recorder, ids, before: new Date(Math.max(...matches.map(match => Date.parse(match.played_at))) + 1).toISOString(), count: ids.length };
}

export async function prepareRepair(cohortPath, outPath) {
  const output = resolve(outPath);
  if (output === root || output.startsWith(root + sep)) throw new Error('Private SQL must stay outside the repository');
  const { recorder, ids, before, count } = repairParameters(JSON.parse((await readFile(cohortPath, 'utf8')).replace(/^\uFEFF/, '')));
  await mkdir(output, { recursive: true });
  const settings = `set local app.season_11_recorder = '${recorder}';\nset local app.season_11_before = '${before}';\n`;
  const locks = families.map(family => `perform pg_advisory_xact_lock(hashtextextended('${family}', 0));`).join('\n');
  const prefix = `begin;\nset local lock_timeout = '15s';\nset local statement_timeout = '180s';\n${settings}
do $locks$ begin\n${locks}\nend $locks$;
lock table public.tracked_matches, public.tracked_match_recorders, public.participants,
public.match_hero_kills, public.match_hero_timelines in share row exclusive mode;
do $cohort$ begin
if (select array_agg(t.id order by t.id) from public.tracked_matches t
join public.tracked_match_recorders r on r.tracked_match_id=t.id
where r.recorded_by=current_setting('app.season_11_recorder')
and t.played_at >= '2026-11-13T11:00:00Z' and t.played_at < current_setting('app.season_11_before')::timestamptz)
is distinct from array[${ids.join(',')}]::bigint[] then raise exception 'The exact private cohort changed'; end if;
end $cohort$;\n`;
  const applyBody = await readFile(join(root, migration), 'utf8');
  const classificationChecks = await readFile(join(root, 'supabase/checks/season_11_match_classification.sql'), 'utf8');
  const call = `public.repair_season_11_matches(current_setting('app.season_11_recorder'),current_setting('app.season_11_before')::timestamptz,${count})`;
  const baseline = `create temporary table season_11_conservation on commit drop as
select count(*) lines, coalesce(sum(kills),0) kills, coalesce(sum(deaths),0) deaths,
coalesce(sum(assists),0) assists, count(*) filter(where is_win) wins,
md5(coalesce(jsonb_agg(to_jsonb(p) order by id) filter(where half_season=10)::text,'')) season_10
from public.participants p;
`;
  const verify = `do $verify$ declare previous record; current_state record; repeated jsonb; begin
select * into previous from pg_temp.season_11_conservation;
select count(*) lines, coalesce(sum(kills),0) kills, coalesce(sum(deaths),0) deaths,
coalesce(sum(assists),0) assists, count(*) filter(where is_win) wins,
md5(coalesce(jsonb_agg(to_jsonb(p) order by id) filter(where half_season=10)::text,'')) season_10
into current_state from public.participants p;
if to_jsonb(previous) is distinct from to_jsonb(current_state) then raise exception 'Raw totals or Season10 rows changed'; end if;
repeated := ${call};
if (repeated->>'tracked_changed')::int<>0 or (repeated->>'participants_changed')::int<>0
or (repeated->>'kill_rows_changed')::int<>0 or (repeated->>'timeline_rows_changed')::int<>0
then raise exception 'Repeated repair was not idempotent'; end if;
end $verify$;\n`;
  const body = prefix + baseline + applyBody + '\n' + classificationChecks + `\nselect ${call} as repaired;\n` + verify;
  await writeFile(join(output, 'dry-run.sql'), body + 'rollback;\n');
  await writeFile(join(output, 'apply.sql'), body + 'commit;\n');
  await writeFile(join(output, 'backup.sql'), `begin read only;\n${settings}` + await readFile(join(root, 'supabase/checks/season_11_repair_backup.sql'), 'utf8') + '\ncommit;\n');
  return { count, before, output };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cohortPath, outPath] = process.argv.slice(2);
  if (!cohortPath || !outPath) throw new Error('Usage: node scripts/prepare-season-11-repair.mjs <private-cohort.json> <private-output-folder>');
  const prepared = await prepareRepair(cohortPath, outPath);
  console.log(`Prepared private backup/dry-run/apply SQL for ${prepared.count} audited matches, before ${prepared.before}. No SQL executed.`);
}
