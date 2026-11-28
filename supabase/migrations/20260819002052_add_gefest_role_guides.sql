alter table public.hero_videos
drop constraint hero_videos_video_type_check;

alter table public.hero_videos
add constraint hero_videos_video_type_check
check (video_type in ('gefest-role-guide', 'paz-gameplay', 'paz-counters-combos'));
