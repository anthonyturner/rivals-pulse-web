-- The "Show me in Pulse Records" switch (issue 568, ADR-0006). Additive: two new functions and one
-- trigger; no table or function the overlay calls is touched, and `20261107100000_account_settings.sql`
-- is not edited.
--
-- `account_settings` is read-only to every API role, so the only way to change the setting is
-- `set_records_opt_in`, which acts on the signed-in account and on nothing else. The table has no
-- trigger of its own, so the function sets `updated_at` itself.
--
-- The setting belongs to the account but the name it releases belongs to the link. Left alone it would
-- survive an unlink, and an account that opted in, unlinked and linked a different player would be
-- named at once with the new link's name without having chosen that. So the setting goes back to off
-- whenever a link row is deleted. Every way a link ends deletes that row (`unlink_player`,
-- `unlink_player_for_recorder`, the "latest proof wins" delete in `redeem_link_code` when the account
-- moves to another player or when another account takes the recorder, and the cascade from deleting
-- the account), so one trigger on the row covers all of them and a later function that removes a
-- link is covered too. Linking the same player again also switches it off: the code cannot tell that
-- from a different player, and asking again costs the player one click.

-- Turns naming on or off for the signed-in account. Returns {"status":"saved","showInRecords":bool},
-- or {"status":"not_linked"} when asked to turn it on without a link (naming has no name to show; the
-- read also needs the link, so this only keeps the stored value honest). Turning it off always works.
create or replace function public.set_records_opt_in(p_show boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  account uuid := (select auth.uid());
begin
  if account is null then
    raise exception 'Sign in to change this setting' using errcode = '28000';
  end if;

  if p_show is null then
    raise exception 'Choose on or off' using errcode = '22004';
  end if;

  -- Holding the link row makes an unlink or a relink wait for this write, then run its reset after it,
  -- so the setting can never be left on by a write that raced the link ending.
  perform 1 from public.player_links where user_id = account for share;

  if p_show and not found then
    return jsonb_build_object('status', 'not_linked');
  end if;

  insert into public.account_settings (user_id, show_in_records, updated_at)
  values (account, p_show, now())
  on conflict (user_id) do update
    set show_in_records = excluded.show_in_records, updated_at = now();

  return jsonb_build_object('status', 'saved', 'showInRecords', p_show);
end
$$;

-- Switches naming off for the account whose link row is going. Runs as the owner because every API
-- role is closed out of `account_settings`.
create or replace function public.reset_records_opt_in()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.account_settings
  set show_in_records = false, updated_at = now()
  where user_id = old.user_id and show_in_records;

  return old;
end
$$;

drop trigger if exists player_links_reset_records_opt_in on public.player_links;
create trigger player_links_reset_records_opt_in
  after delete on public.player_links
  for each row execute function public.reset_records_opt_in();

-- Postgres grants EXECUTE to everyone on a new function, and Supabase's default privileges give
-- service_role its own grant too: restate who may call each.
revoke execute on function public.set_records_opt_in(boolean) from public, anon, authenticated, service_role;
revoke execute on function public.reset_records_opt_in() from public, anon, authenticated, service_role;
grant execute on function public.set_records_opt_in(boolean) to authenticated;
