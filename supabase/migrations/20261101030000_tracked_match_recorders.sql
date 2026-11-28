-- Issue 328: record which verified recorder uploaded each tracked match, so a linked player's
-- dashboard can later count matches older than the six-month `participants` window.
--
-- A side table, not a column: `tracked_matches` is readable by anyone, and the recorder id is the
-- hash that identifies a linked person. Additive only; no overlay-facing object changes.
--
-- Rows are written by `track-match-history` from its deploy date onward, so matches uploaded before
-- then have no row. Deleting or pruning a tracked match (or its player) deletes its row here.

create table if not exists public.tracked_match_recorders (
  tracked_match_id bigint primary key references public.tracked_matches (id) on delete cascade,
  recorded_by text not null,
  recorded_at timestamptz not null default now()
);

alter table public.tracked_match_recorders enable row level security;

-- Supabase grants new tables to the API roles by default; this one is for the service role only.
revoke all on public.tracked_match_recorders from anon, authenticated;
grant select, insert, update, delete on public.tracked_match_recorders to service_role;
