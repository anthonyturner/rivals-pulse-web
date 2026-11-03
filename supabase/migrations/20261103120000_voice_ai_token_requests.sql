-- The publishable key cannot reach this table, so shipped overlays are unaffected.
alter table public.jarvis_token_requests rename to voice_ai_token_requests;
alter table public.voice_ai_token_requests
  rename constraint jarvis_token_requests_pkey to voice_ai_token_requests_pkey;
alter index public.jarvis_token_requests_ip_requested_at_idx
  rename to voice_ai_token_requests_ip_requested_at_idx;
alter sequence public.jarvis_token_requests_id_seq rename to voice_ai_token_requests_id_seq;
