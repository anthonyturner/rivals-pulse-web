-- The media defaults of a signed-in account (issue 705): whether the hero page plays its gameplay
-- video by default, and whether video and the home pulse banner make sound by default. Additive: two
-- columns on `account_settings` and one function; nothing the overlay calls is touched, and the
-- earlier migrations are not edited.
--
-- Both are off until the owner turns them on, and an account with no settings row reads as off. The
-- table stays read-only to every API role (the owner selects their own row; table-level grants cover
-- the new columns), so `set_media_defaults` is the only way to change them. It acts on the signed-in
-- account and on nothing else, and, like `set_records_opt_in`, sets `updated_at` itself because the
-- table has no trigger.

alter table public.account_settings
  add column if not exists hero_video_default boolean not null default false,
  add column if not exists sound_default boolean not null default false;

-- Saves the defaults the caller names and leaves the other alone (null means "leave it"), so the two
-- controls on the account page save independently. Returns {"status":"saved","heroVideo":bool,"sound":bool}
-- with both values as stored.
create or replace function public.set_media_defaults(p_hero_video boolean default null, p_sound boolean default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  account uuid := (select auth.uid());
  stored_video boolean;
  stored_sound boolean;
begin
  if account is null then
    raise exception 'Sign in to change this setting' using errcode = '28000';
  end if;

  if p_hero_video is null and p_sound is null then
    raise exception 'Choose a setting to change' using errcode = '22004';
  end if;

  insert into public.account_settings as settings (user_id, hero_video_default, sound_default, updated_at)
  values (account, coalesce(p_hero_video, false), coalesce(p_sound, false), now())
  on conflict (user_id) do update
    set hero_video_default = coalesce(p_hero_video, settings.hero_video_default),
        sound_default = coalesce(p_sound, settings.sound_default),
        updated_at = now()
  returning settings.hero_video_default, settings.sound_default into stored_video, stored_sound;

  return jsonb_build_object('status', 'saved', 'heroVideo', stored_video, 'sound', stored_sound);
end
$$;

revoke execute on function public.set_media_defaults(boolean, boolean) from public, anon, authenticated, service_role;
grant execute on function public.set_media_defaults(boolean, boolean) to authenticated;
