/**
 * Different players that must have recorded a rank band of hero pairs, triple supports or team
 * line-ups before it is published. Mirrors `p_recorders >= N` in `public.community_bucket_shown`,
 * where the rule is applied; a test compares the two.
 */
export const COMMUNITY_BUCKET_MIN_PLAYERS = 2;
