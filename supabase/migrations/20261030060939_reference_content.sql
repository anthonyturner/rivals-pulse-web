-- Glossary terms for the website, moved from Turso (issue 106). Additive only: one new table.
-- The other two tables of this slice exist already: `hero_videos` (20260819001043, which holds the
-- same videos as Turso) and `external_sources` (20261030042403).
--
-- Nothing here is readable with the publishable key: RLS is on, there is no policy, and only the
-- service role has grants. The website reads and writes through its server.

-- `raw_json` is the record `/api/glossary` returns as is; the other columns repeat fields of it so
-- they can be listed and checked without opening the blob.
create table if not exists public.glossary_terms (
  id text primary key,
  term text not null,
  -- The order SQLite's `COLLATE NOCASE` gave: only A-Z fold to lower case (that is what lower()
  -- does under the "C" collation), then byte order.
  term_sort_key text collate "C" generated always as (lower(term collate "C")) stored,
  category text not null,
  definition text not null,
  coach_note text not null,
  example text not null,
  related_terms jsonb not null default '[]'::jsonb,
  source_name text not null,
  source_url text not null,
  raw_json jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists glossary_terms_term_sort_key_idx
  on public.glossary_terms (term_sort_key, id);

alter table public.glossary_terms enable row level security;

revoke all on table public.glossary_terms from anon, authenticated;

grant select, insert, update, delete on table public.glossary_terms to service_role;
